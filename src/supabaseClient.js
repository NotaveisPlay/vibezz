import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://jnpkccitovpqsbiptdpz.supabase.co";
export const SUPABASE_ASSETS_BUCKET = "game-assets";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vt7j4-1YJFf3856-6g4QBg_JWQ2PBbC";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export function getPublicAssetUrl(path) {
  const { data } = supabase.storage.from(SUPABASE_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
