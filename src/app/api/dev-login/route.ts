import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { type, email } = await req.json() as { type: "admin" | "user" | "logout"; email?: string };
  const res = NextResponse.json({ ok: true });

  if (type === "logout") {
    res.cookies.set("gp-user",  "", { path: "/", maxAge: 0 });
    res.cookies.set("gp-admin", "", { path: "/", maxAge: 0 });
  } else {
    const userEmail = email ?? (type === "admin" ? "christian@garasjeproffen.no" : "test@example.com");
    res.cookies.set("gp-user", userEmail, { path: "/", maxAge: 60 * 60 * 24 * 7 });
    if (type === "admin") {
      res.cookies.set("gp-admin", "1", { path: "/", maxAge: 60 * 60 * 24 * 7 });
    } else {
      res.cookies.set("gp-admin", "", { path: "/", maxAge: 0 });
    }
  }

  return res;
}
