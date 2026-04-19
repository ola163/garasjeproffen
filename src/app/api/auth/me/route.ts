import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import { sessionOptions, type CustomerSession } from "@/lib/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<CustomerSession>(cookieStore, sessionOptions);
    if (session.isLoggedIn) {
      return NextResponse.json({ isLoggedIn: true, name: session.name });
    }
  } catch {}
  return NextResponse.json({ isLoggedIn: false });
}
