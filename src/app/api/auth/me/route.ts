import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  const isAdmin = cookieStore.get("gp-admin")?.value === "1";
  if (email) {
    return NextResponse.json({ isLoggedIn: true, email, isAdmin });
  }
  return NextResponse.json({ isLoggedIn: false, isAdmin: false });
}
