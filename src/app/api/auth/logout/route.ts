import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type CustomerSession } from "@/lib/session";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/min-side", new URL(request.url).origin));
  const session = await getIronSession<CustomerSession>(request, response, sessionOptions);
  session.destroy();
  return response;
}
