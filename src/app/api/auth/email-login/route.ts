import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAILS } from "@/lib/session";

const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const idToken = body?.idToken;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
    }

    const sb = supabaseAdmin();
    if (!sb) {
      return NextResponse.json({ error: "Tjenesten er ikke tilgjengelig." }, { status: 503 });
    }

    // Verify the Supabase JWT — this is the only source of truth for the email
    const { data: { user }, error } = await sb.auth.getUser(idToken);
    if (error || !user?.email) {
      return NextResponse.json({ error: "Ugyldig innloggingstoken." }, { status: 401 });
    }

    const email = user.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);

    const res = NextResponse.json({ success: true });
    const maxAge = 60 * 60 * 8;
    res.cookies.set("gp-user", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    res.cookies.set("gp-admin", isAdmin ? "1" : "0", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Email login error:", err);
    return NextResponse.json({ error: "Innlogging feilet." }, { status: 500 });
  }
}
