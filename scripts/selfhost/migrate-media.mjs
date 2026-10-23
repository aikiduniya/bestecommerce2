#!/usr/bin/env node
// Upload ./media-export/** to the new "media" bucket and rewrite old storage URLs in all public tables.
// Env: OLD_STORAGE_URL, NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, DATABASE_URL, MEDIA_DIR (default ./media-export)
// Flags: --dry-run (no writes). Requires: npm i pg @supabase/supabase-js
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const { OLD_STORAGE_URL, NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
const MEDIA_DIR = process.env.MEDIA_DIR || "./media-export";
for (const [k, v] of Object.entries({ OLD_STORAGE_URL, NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, DATABASE_URL })) if (!v) { console.error(`Missing ${k}`); process.exit(1); }
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif", ".mp4": "video/mp4", ".pdf": "application/pdf" };

const sb = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function* walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }

// 1) upload
const urlFor = new Map();
for await (const file of walk(MEDIA_DIR)) {
  const path = relative(MEDIA_DIR, file).split("\\").join("/");
  if (!DRY) {
    const { error } = await sb.storage.from("media").upload(path, await readFile(file), { upsert: true, contentType: MIME[extname(path).toLowerCase()] ?? "application/octet-stream", cacheControl: "31536000" });
    if (error) { console.error("upload failed", path, error.message); continue; }
    const { data, error: e2 } = await sb.storage.from("media").createSignedUrl(path, TEN_YEARS);
    if (e2) { console.error("sign failed", path, e2.message); continue; }
    urlFor.set(path, data.signedUrl);
  } else urlFor.set(path, `${NEW_SUPABASE_URL}/storage/v1/object/sign/media/${path}?token=…`);
}
console.log(`files: ${urlFor.size}`);

// 2) rewrite URLs in every text/json column of public tables
const oldRe = new RegExp(OLD_STORAGE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/storage/v1/object/(?:sign|public)/media/([^\"'?\\s)]+)(?:\\?[^\"'\\s)]*)?", "g");
const db = new pg.Client({ connectionString: DATABASE_URL }); await db.connect();
const cols = (await db.query(`select table_name, column_name, data_type from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
  where table_schema='public' and t.table_type='BASE TABLE' and data_type in ('text','jsonb','json','ARRAY','character varying')`)).rows;
const log = []; let missing = 0;
for (const { table_name: t, column_name: c, data_type: dt } of cols) {
  const cast = dt === "ARRAY" ? "array_to_json" : dt.startsWith("json") ? "" : "";
  const rows = (await db.query(`select ctid::text as id, ${cast ? `${cast}("${c}")::text` : `"${c}"::text`} as v from public."${t}" where "${c}"::text like $1`, [`%${OLD_STORAGE_URL}%`])).rows;
  let changed = 0;
  for (const r of rows) {
    const nv = r.v.replace(oldRe, (m, p) => { const u = urlFor.get(decodeURIComponent(p)); if (!u) { missing++; return m; } return u; });
    if (nv === r.v) continue;
    log.push({ table: t, column: c, ctid: r.id, before: r.v });
    if (!DRY) {
      const expr = dt === "ARRAY" ? `array(select json_array_elements_text($1::json))` : dt.startsWith("json") ? `$1::${dt}` : "$1";
      await db.query(`update public."${t}" set "${c}" = ${expr} where ctid = $2::tid`, [nv, r.id]);
    }
    changed++;
  }
  if (changed) console.log(`${t}.${c}: ${changed} row(s)`);
}
await db.end();
await writeFile(`media-rewrite-log-${Date.now()}.json`, JSON.stringify(log));
console.log(`${DRY ? "[dry-run] " : ""}done. URLs without a matching file: ${missing}`);
