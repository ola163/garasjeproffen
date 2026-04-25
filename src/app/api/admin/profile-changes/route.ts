import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

function getSB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function isAdmin(req: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (session === process.env.ADMIN_SESSION_SECRET) return "admin";

  const sb = getSB();
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb.auth.getUser(token);
  if (user?.email && ALLOWED_ADMINS.includes(user.email.toLowerCase())) return user.email;
  return null;
}

// GET — all changes (filter by status via ?status=pending_approval)
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = sb
    .from("profile_change_log")
    .select("id, user_email, change_type, old_value, new_value, status, changed_at, reviewed_by, reviewed_at, note")
    .order("changed_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data } = await query;
  return NextResponse.json({ changes: data ?? [] });
}

// PATCH — approve or reject an address change
export async function PATCH(req: NextRequest) {
  const adminEmail = await isAdmin(req);
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, note } = (await req.json()) as { id: string; action: "approve" | "reject"; note?: string };
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const sb = getSB();
  const now = new Date().toISOString();

  // Fetch the change record
  const { data: change } = await sb
    .from("profile_change_log")
    .select("*")
    .eq("id", id)
    .single();

  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (change.status !== "pending_approval") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  const newStatus = action === "approve" ? "approved" : "rejected";

  // Update log
  await sb.from("profile_change_log").update({
    status: newStatus,
    reviewed_by: adminEmail,
    reviewed_at: now,
    note: note ?? null,
  }).eq("id", id);

  // If approved, apply the change to user_profiles
  if (action === "approve" && change.change_type === "address") {
    await sb.from("user_profiles").upsert(
      { email: change.user_email, address: change.new_value, address_pending: null, updated_at: now },
      { onConflict: "email" }
    );
  } else if (action === "reject" && change.change_type === "address") {
    // Clear pending
    await sb.from("user_profiles").update({ address_pending: null, updated_at: now })
      .eq("email", change.user_email);
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
