import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = cookieStore.get("gp-user")?.value;
  if (!adminEmail) {
    return Response.json({ error: "Ingen admin-epost funnet i sesjonen" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const ip: string | undefined = body?.ip;
  if (!ip || typeof ip !== "string") {
    return Response.json({ error: "IP mangler" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "DB ikke konfigurert" }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient(url, key) as any;

  const { data, error } = await db
    .from("visitor_logs")
    .update({ user_email: adminEmail.toLowerCase() })
    .eq("ip", ip)
    .select("id");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true, updated: (data as unknown[])?.length ?? 0 });
}
