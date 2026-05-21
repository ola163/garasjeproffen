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

  const { soknadshjelId } = await request.json();
  if (!soknadshjelId) return NextResponse.json({ error: "Mangler soknadshjelId." }, { status: 400 });

  const { data: row } = await sb.from("soknadshjelp").select("id,status").eq("id", soknadshjelId).single();
  if (!row) return NextResponse.json({ error: "Saken finnes ikke." }, { status: 404 });
  if (row.status !== "cancelled") return NextResponse.json({ error: "Kan kun slette kansellerte saker." }, { status: 400 });

  // Delete storage attachments
  const { data: attachments } = await sb
    .from("soknadshjelp_attachments")
    .select("file_path")
    .eq("soknadshjelp_id", soknadshjelId);
  if (attachments?.length) {
    await sb.storage.from("soknadshjelp-attachments").remove(attachments.map(a => a.file_path));
  }

  // Delete related records
  await sb.from("soknadshjelp_attachments").delete().eq("soknadshjelp_id", soknadshjelId);
  await sb.from("activity_log").delete().eq("entity_type", "soknadshjelp").eq("entity_id", soknadshjelId);

  const { error } = await sb.from("soknadshjelp").delete().eq("id", soknadshjelId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
