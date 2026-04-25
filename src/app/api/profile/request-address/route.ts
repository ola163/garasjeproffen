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

  const { address } = (await req.json()) as { address: string };
  if (!address?.trim()) return NextResponse.json({ error: "address required" }, { status: 400 });

  const sb = getSB();
  const { data: existing } = await sb
    .from("user_profiles")
    .select("address, address_pending")
    .eq("email", email)
    .maybeSingle();

  const now = new Date().toISOString();

  // Store pending address on profile
  await sb.from("user_profiles").upsert(
    { email, address_pending: address.trim(), updated_at: now },
    { onConflict: "email" }
  );

  // Log the change request
  const { data: logEntry } = await sb.from("profile_change_log").insert({
    user_email: email,
    change_type: "address",
    old_value: existing?.address ?? null,
    new_value: address.trim(),
    status: "pending_approval",
  }).select("id").single();

  return NextResponse.json({ ok: true, logId: logEntry?.id });
}
