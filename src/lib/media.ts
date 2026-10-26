import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];

/** Uploads an image to the private media bucket and records it in the media library. Returns a long-lived URL. */
/** Uploads with real byte progress (XHR to the storage endpoint, same auth as the client). */
async function uploadWithProgress(path: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  const { data: s } = await supabase.auth.getSession();
  const base = import.meta.env["VITE_SUPABASE_URL"] as string;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/media/${path}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("Authorization", `Bearer ${s.session?.access_token ?? key}`);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`${file.name}: upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error(`${file.name}: upload failed`));
    xhr.send(file);
  });
}

export async function uploadMedia(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error(`${file.name}: only image files are allowed`);
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: max size is 10MB`);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  if (onProgress) {
    await uploadWithProgress(path, file, onProgress);
  } else {
    const up = await supabase.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (up.error) throw up.error;
  }
  const signed = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (signed.error) throw signed.error;
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("media").insert({
    url: signed.data.signedUrl,
    path,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    created_by: u.user?.id ?? null,
  });
  if (error) throw error;
  return signed.data.signedUrl;
}
