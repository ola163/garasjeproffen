import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { sessionOptions, type CustomerSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) return NextResponse.json({ error: "Mangler telefonnummer." }, { status: 400 });

    const cookieStore = await cookies();
    const session = await getIronSession<CustomerSession>(cookieStore, sessionOptions);
    session.sub = phone;
    session.name = phone;
    session.phone = phone;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Phone login error:", err);
    return NextResponse.json({ error: "Innlogging feilet." }, { status: 500 });
  }
}
