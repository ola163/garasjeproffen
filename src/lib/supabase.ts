import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Supabase not configured — auth features will be disabled
  console.warn("Supabase env vars not set. Auth/save features disabled.");
}

export const supabase = url && key ? createClient(url, key) : null;

export type SavedConfig = {
  id: string;
  name: string;
  config: {
    packageType: string;
    roofType: string;
    length: number;
    width: number;
    doorWidth: number;
    doorHeight: number;
    addedElements: { side: string; category: string; placement: string }[];
  };
  created_at: string;
};
