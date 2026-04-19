import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { sessionOptions, type CustomerSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "Mangler e-post." }, { status: 400 });

    const cookieStore = await cookies();
    const session = await getIronSession<CustomerSession>(cookieStore, sessionOptions);
    session.sub = email;
    session.name = email;
    session.email = email;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email login error:", err);
    return NextResponse.json({ error: "Innlogging feilet." }, { status: 500 });
  }
}
