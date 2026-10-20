import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];

/** Uploads an image to the private media bucket and records it in the media library. Returns a long-lived URL. */
export async function uploadMedia(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error(`${file.name}: only image files are allowed`);
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: max size is 10MB`);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (up.error) throw up.error;
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
