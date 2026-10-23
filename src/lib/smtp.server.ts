// Server-only SMTP helpers.
import type { SmtpRow } from "@/lib/smtp-types";

async function aesKey() {
  const secret = process.env["SMTP_ENCRYPTION_KEY"];
  if (!secret) throw new Error("Encryption key is not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptSecret(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plain)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}
export async function decryptSecret(enc: string) {
  const [v, iv, ct] = enc.split(":");
  if (v !== "v1" || !iv || !ct) throw new Error("Unreadable stored password");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(), unb64(ct));
  return new TextDecoder().decode(pt);
}


/** Send one plain-text message through an SMTP profile. Works on the published (Cloudflare) runtime. */
export async function smtpSend(p: SmtpRow, to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!p.host || !p.sender_email) return { ok: false, error: "Host and sender email are required" };
  try {
    const password = p.password_encrypted ? await decryptSecret(p.password_encrypted) : "";
    const isWorkerd = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
    if (!isWorkerd && typeof process !== "undefined" && process.versions?.node) {
      // Self-hosted Node.js: use nodemailer (installed on the server, never bundled for Cloudflare).
      const spec = "nodemailer";
      const nm = (await import(/* @vite-ignore */ spec)) as { createTransport: (o: unknown) => { sendMail: (m: unknown) => Promise<unknown> } };
      await nm.createTransport({
        host: p.host, port: p.port, secure: p.encryption === "ssl", requireTLS: p.encryption === "starttls",
        ...(p.username ? { auth: { user: p.username, pass: password } } : {}),
        connectionTimeout: 15000, socketTimeout: 15000,
      }).sendMail({ from: p.sender_name ? { name: p.sender_name, address: p.sender_email } : p.sender_email, to, subject, text });
      return { ok: true };
    }
    const { WorkerMailer } = await import("worker-mailer");
    await WorkerMailer.send(
      {
        host: p.host, port: p.port, secure: p.encryption === "ssl", startTls: p.encryption === "starttls",
        ...(p.username ? { credentials: { username: p.username, password }, authType: ["plain", "login"] as never } : {}),
        socketTimeoutMs: 15000, responseTimeoutMs: 15000,
      },
      { from: { name: p.sender_name ?? undefined, email: p.sender_email } as never, to: { email: to }, subject, text },
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cloudflare:sockets|Cannot find (package|module)/i.test(msg)) return { ok: false, error: "SMTP test only runs on the published site (not in the editor preview)" };
    return { ok: false, error: msg.slice(0, 300) };
  }
}

