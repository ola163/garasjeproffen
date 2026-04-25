import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getEmail(req: NextRequest): Promise<string | null> {
  const sb = getSB();
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb.auth.getUser(token);
  return user?.email ?? null;
}

export async function POST(req: NextRequest) {
  const email = await getEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { phone } = (await req.json()) as { phone: string };
  if (!phone?.trim()) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const sb = getSB();
  const { data: existing } = await sb
    .from("user_profiles")
    .select("phone")
    .eq("email", email)
    .maybeSingle();

  const now = new Date().toISOString();
  await sb.from("user_profiles").upsert(
    { email, phone: phone.trim(), phone_verified_at: now, updated_at: now },
    { onConflict: "email" }
  );

  await sb.from("profile_change_log").insert({
    user_email: email,
    change_type: "phone",
    old_value: existing?.phone ?? null,
    new_value: phone.trim(),
    status: "completed",
  });

  return NextResponse.json({ ok: true });
}
