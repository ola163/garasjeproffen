import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const cookieStore = await cookies();
    const email = cookieStore.get("gp-user")?.value;
    const isAdmin = cookieStore.get("gp-admin")?.value === "1";

    if (!email || !isAdmin) {
      return NextResponse.redirect(`${origin}/min-side`);
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sbUrl || !sbKey) {
      return NextResponse.redirect(`${origin}/admin`);
    }

    const sb = createClient(sbUrl, sbKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase().trim(),
      options: { redirectTo: `${origin}/admin` },
    });

    if (error || !data.properties?.action_link) {
      console.error("generateLink error:", error);
      return NextResponse.redirect(`${origin}/admin?auto_login_error=${encodeURIComponent(error?.message ?? "no_link")}`);
    }

    return NextResponse.redirect(data.properties.action_link);
  } catch (err) {
    console.error("admin-auto-login error:", err);
    return NextResponse.redirect(`${origin}/admin`);
  }
}
