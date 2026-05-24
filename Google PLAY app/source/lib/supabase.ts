import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL  = "https://knznyeiorsypxwireuok.supabase.co";
const SUPABASE_ANON = "sb_publishable_XOOC-T3yqRU2TbgY0nvDOA_Bu9IEfVc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type SavedConfig = {
  id: string;
  name: string;
  config: {
    packageType: string;
    roofType: string;
    length: number;
    width: number;
  };
  created_at: string;
};
