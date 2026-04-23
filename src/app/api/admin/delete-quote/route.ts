import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAILS } from "@/lib/session";

export async function DELETE(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Ikke autorisert." }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user?.email || !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Ikke autorisert." }, { status: 401 });
  }

  const { quoteId } = await request.json();
  if (!quoteId) return NextResponse.json({ error: "Mangler quoteId." }, { status: 400 });

  await sb.from("quote_status_logs").delete().eq("quote_id", quoteId);
  const { error } = await sb.from("quotes").delete().eq("id", quoteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
