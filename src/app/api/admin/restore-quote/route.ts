import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAILS } from "@/lib/session";

export async function POST(request: Request) {
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

  const { data: quote } = await sb.from("quotes").select("deleted_at").eq("id", quoteId).single();
  if (!quote?.deleted_at) return NextResponse.json({ error: "Forespørselen er ikke slettet." }, { status: 400 });

  const deletedAt = new Date(quote.deleted_at);
  const daysSince = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 10) return NextResponse.json({ error: "Gjenoppretting er ikke mulig etter 10 dager." }, { status: 400 });

  const { error } = await sb.from("quotes")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", quoteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
