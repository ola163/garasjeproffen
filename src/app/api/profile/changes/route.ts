import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getSB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  if (!email) return NextResponse.json({ changes: [] });

  const sb = getSB();
  const { data } = await sb
    .from("profile_change_log")
    .select("id, change_type, old_value, new_value, status, changed_at, reviewed_by, reviewed_at, note")
    .eq("user_email", email)
    .order("changed_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ changes: data ?? [] });
}
