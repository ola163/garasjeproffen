import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { sessionOptions, ADMIN_EMAILS, type CustomerSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { email: rawEmail } = await request.json();
    if (!rawEmail) return NextResponse.json({ error: "Mangler e-post." }, { status: 400 });
    const email = rawEmail.toLowerCase().trim();

    const cookieStore = await cookies();
    const session = await getIronSession<CustomerSession>(cookieStore, sessionOptions);
    session.sub = email;
    session.name = email;
    session.email = email;
    session.isLoggedIn = true;
    session.isAdmin = ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);
    await session.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? "ukjent";
    console.error("Email login error:", msg, err);
    return NextResponse.json({ error: `Sesjonsfeil: ${msg}` }, { status: 500 });
  }
}
