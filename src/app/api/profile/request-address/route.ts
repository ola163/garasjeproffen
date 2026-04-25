import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const ADMINS = ["christian@garasjeproffen.no", "ola@garasjeproffen.no"];
const ACTIVE_STATUSES = ["new", "in_review", "pending_approval", "offer_sent"];

function getSB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getEmail(req: NextRequest): Promise<string | null> {
  const sb = getSB();
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb.auth.getUser(token);
  return user?.email ?? null;
}

export async function POST(req: NextRequest) {
  const email = await getEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { address } = (await req.json()) as { address: string };
  if (!address?.trim()) return NextResponse.json({ error: "address required" }, { status: 400 });

  const sb = getSB();
  const { data: existing } = await sb
    .from("user_profiles")
    .select("address")
    .eq("email", email)
    .maybeSingle();

  const oldAddress = existing?.address ?? null;
  const now = new Date().toISOString();

  // Save address directly — no approval step
  await sb.from("user_profiles").upsert(
    { email, address: address.trim(), address_pending: null, updated_at: now },
    { onConflict: "email" }
  );

  // Log as completed
  await sb.from("profile_change_log").insert({
    user_email: email,
    change_type: "address",
    old_value: oldAddress,
    new_value: address.trim(),
    status: "completed",
  });

  // Check for active quotes — notify admin if any
  const { data: activeQuotes } = await sb
    .from("quotes")
    .select("id, ticket_number, customer_name")
    .eq("customer_email", email)
    .in("status", ACTIVE_STATUSES);

  if (activeQuotes && activeQuotes.length > 0) {
    const note = `Adresse endret etter innsendelse. Ny adresse: ${address.trim()}${oldAddress ? ` (tidligere: ${oldAddress})` : ""}`;

    // Flag each active quote
    await Promise.all(
      activeQuotes.map((q) =>
        sb.from("quotes").update({ address_change_note: note }).eq("id", q.id)
      )
    );

    // Email admins
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const quoteLinks = activeQuotes
        .map(
          (q) =>
            `<li style="margin-bottom:4px"><a href="https://www.garasjeproffen.no/admin/quotes/${q.id}">${q.ticket_number} – ${q.customer_name}</a></li>`
        )
        .join("");
      await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: ADMINS,
        subject: `Adresse endret etter innsendt forespørsel – ${email}`,
        html: `
          <p><strong>${email}</strong> har endret sin adresse.</p>
          <p><strong>Ny adresse:</strong> ${address.trim()}</p>
          ${oldAddress ? `<p><strong>Gammel adresse:</strong> ${oldAddress}</p>` : ""}
          <p>Følgende aktive forespørsler er berørt:</p>
          <ul>${quoteLinks}</ul>
          <p style="color:#6b7280;font-size:12px">Varselet vises også i forespørselen i adminpanelet.</p>
        `,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
