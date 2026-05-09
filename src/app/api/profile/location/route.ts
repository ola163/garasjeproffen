import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getSB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  if (!email) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { lat, lng, address } = await req.json() as { lat: number; lng: number; address?: string };
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ ok: false, error: "lat and lng required" }, { status: 400 });
  }

  const sb = getSB();
  const { error } = await sb
    .from("user_profiles")
    .upsert(
      { email, map_lat: lat, map_lng: lng, ...(address ? { address } : {}) },
      { onConflict: "email" },
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  if (!email) return NextResponse.json({ location: null });

  const sb = getSB();
  const { data } = await sb
    .from("user_profiles")
    .select("map_lat, map_lng, address")
    .eq("email", email)
    .maybeSingle();

  return NextResponse.json({ location: data });
}
