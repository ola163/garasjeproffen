import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getSB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  if (!email) return NextResponse.json({ profile: null, email: null });

  const sb = getSB();
  const { data: profile } = await sb
    .from("user_profiles")
    .select("phone, phone_verified_at, address, address_pending, updated_at")
    .eq("email", email)
    .maybeSingle();

  return NextResponse.json({ profile, email });
}
