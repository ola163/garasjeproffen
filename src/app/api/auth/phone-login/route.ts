import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { sessionOptions, type CustomerSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) return NextResponse.json({ error: "Mangler telefonnummer." }, { status: 400 });

    // Accept Norwegian (8 digits) or international E.164 format (+XXXXXXXXXXX)
    const normalized = String(phone).replace(/\s/g, "");
    const valid = /^(\+\d{7,15}|\d{8})$/.test(normalized);
    if (!valid) return NextResponse.json({ error: "Ugyldig telefonnummer." }, { status: 400 });

    const cookieStore = await cookies();
    const session = await getIronSession<CustomerSession>(cookieStore, sessionOptions);
    session.sub = normalized;
    session.name = normalized;
    session.phone = normalized;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Phone login error:", err);
    return NextResponse.json({ error: "Innlogging feilet." }, { status: 500 });
  }
}
