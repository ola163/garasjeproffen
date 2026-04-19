import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  if (email) {
    return NextResponse.json({ isLoggedIn: true, email });
  }
  return NextResponse.json({ isLoggedIn: false });
}
