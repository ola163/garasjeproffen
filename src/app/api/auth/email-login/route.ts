import { NextResponse } from "next/server";
import { ADMIN_EMAILS } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { email: rawEmail } = await request.json();
    if (!rawEmail) return NextResponse.json({ error: "Mangler e-post." }, { status: 400 });
    const email = rawEmail.toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);

    const res = NextResponse.json({ success: true });
    const maxAge = 60 * 60 * 8; // 8 hours
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
