import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import type { LineItem, OfferSection } from "@/types/quote-admin";
import { generateQuotePdf } from "@/lib/pdf/quote-pdf";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

const SECTION_LABELS: Record<string, string> = {
  søknadshjelp: "Søknadshjelp",
  materialpakke: "Materialpakke",
  prefabelement: "Prefabelement",
  grunnarbeid: "Grunnarbeid og støping",
};

function formatNOK(n: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

function getEffectiveItems(section: OfferSection, allSections: OfferSection[]): LineItem[] {
  const sok = allSections.find((s) => s.category === "søknadshjelp");
  const mat = allSections.find((s) => s.category === "materialpakke");
  if (section.category === "prefabelement") {
    return [...(sok?.line_items ?? []), ...(mat?.line_items ?? []), ...section.line_items];
  }
  if (section.category === "materialpakke") {
    return [...(sok?.line_items ?? []), ...section.line_items];
  }
  return section.line_items;
}

function sectionTotal(section: OfferSection, allSections: OfferSection[]) {
  return getEffectiveItems(section, allSections).reduce((s, item) => s + item.amount * item.quantity, 0);
}

function adjNok(value: number | undefined, type: "kr" | "pst" | undefined, base: number) {
  if (!value) return 0;
  return type === "pst" ? base * value / 100 : value;
}

function lineAdj(item: LineItem, sec: OfferSection): number {
  const base = item.amount * item.quantity;
  const useSec = !item.no_rabatt;
  const rVal = item.rabatt_value !== undefined ? item.rabatt_value : useSec ? sec.rabatt_value : undefined;
  const rType = item.rabatt_value !== undefined ? item.rabatt_type : useSec ? sec.rabatt_type : undefined;
  const pVal = item.påslag_value !== undefined ? item.påslag_value : useSec ? sec.påslag_value : undefined;
  const pType = item.påslag_value !== undefined ? item.påslag_type : useSec ? sec.påslag_type : undefined;
  return adjNok(pVal, pType, base) - adjNok(rVal, rType, base);
}

export async function POST(request: Request) {
  try {
    const { quoteId, offerSections, adminEmail, customerEmail, customerName, ticketNumber, tilbudsbeskrivelse } = await request.json() as {
      quoteId: string;
      offerSections: OfferSection[];
      adminEmail: string;
      customerEmail: string;
      customerName: string;
      ticketNumber: string;
      tilbudsbeskrivelse?: string | null;
    };

    if (!ALLOWED_ADMINS.includes((adminEmail ?? "").toLowerCase())) {
      return NextResponse.json({ success: false, error: "Ikke tilgang" }, { status: 403 });
    }

    if (!customerEmail || !ticketNumber || !offerSections?.length) {
      return NextResponse.json({ success: false, error: "Mangler kundeinformasjon eller tilbudslinjer" }, { status: 400 });
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) {
      return NextResponse.json({ success: false, error: "Supabase ikke konfigurert" }, { status: 500 });
    }

    const sb = createClient(sbUrl, sbKey);
    const hasPrefa = offerSections.some((s) => s.category === "prefabelement");
    const hasMatpak = offerSections.some((s) => s.category === "materialpakke");
    const grandTotal = offerSections.reduce((t, s) => {
      if (hasPrefa && s.category === "materialpakke") return t;
      if ((hasPrefa || hasMatpak) && s.category === "søknadshjelp") return t;
      return t + sectionTotal(s, offerSections);
    }, 0);
    const allLineItems: LineItem[] = offerSections.flatMap(s => {
      if (hasPrefa && s.category === "materialpakke") return [];
      if ((hasPrefa || hasMatpak) && s.category === "søknadshjelp") return [];
      return getEffectiveItems(s, offerSections);
    });

    // ── Fetch GP catalog categories for varenr lookup ──
    const allVarenrs = [...new Set(offerSections.flatMap(s => s.line_items.map(i => i.varenr).filter((v): v is string => !!v)))];
    const gpCatMap = new Map<string, string>();
    if (allVarenrs.length > 0) {
      const { data: prods } = await sb.from("gp_products").select("varenr, category").in("varenr", allVarenrs);
      for (const p of (prods ?? []) as { varenr: string; category: string }[]) gpCatMap.set(p.varenr, p.category);
    }
    const { data: rawCats } = await sb.from("gp_categories").select("label, sort_order").order("sort_order");
    const catSortOrder = new Map((rawCats ?? []).map((c: { label: string; sort_order: number }) => [c.label, c.sort_order]));

    // Split items: materialpakke → GP catalog categories, services → own section totals
    const itemSectionCat = new Map<LineItem, string>();
    for (const s of offerSections) for (const i of s.line_items) itemSectionCat.set(i, s.category);

    const sectionNotes = new Map<string, string>();
    for (const sec of offerSections) {
      if (sec.notes?.trim()) sectionNotes.set(sec.category, sec.notes.trim());
    }

    const seenItems = new Set<LineItem>();
    const gpCatTotals = new Map<string, number>();
    const gpCatOrderMap = new Map<string, number>();
    const serviceSectionTotals = new Map<string, number>();
    const serviceSectionItems = new Map<string, LineItem[]>();

    for (const sec of offerSections) {
      if (hasPrefa  && sec.category === "materialpakke") continue;
      if ((hasPrefa || hasMatpak) && sec.category === "søknadshjelp") continue;
      for (const item of getEffectiveItems(sec, offerSections)) {
        if (seenItems.has(item)) continue;
        seenItems.add(item);
        const raw = item.amount * item.quantity;
        const ownerCat = itemSectionCat.get(item) ?? sec.category;
        if (ownerCat === "materialpakke") {
          const gpCat = (item.varenr && gpCatMap.get(item.varenr)) || "Materialer";
          gpCatTotals.set(gpCat, (gpCatTotals.get(gpCat) ?? 0) + raw);
          if (!gpCatOrderMap.has(gpCat)) gpCatOrderMap.set(gpCat, catSortOrder.get(gpCat) ?? 900);
        } else {
          serviceSectionTotals.set(ownerCat, (serviceSectionTotals.get(ownerCat) ?? 0) + raw);
          serviceSectionItems.set(ownerCat, [...(serviceSectionItems.get(ownerCat) ?? []), item]);
        }
      }
    }

    const gpSortedCats = Array.from(gpCatTotals.entries()).sort(([a], [b]) => (gpCatOrderMap.get(a) ?? 900) - (gpCatOrderMap.get(b) ?? 900));
    const SERVICE_ORDER = ["søknadshjelp", "prefabelement", "grunnarbeid"] as const;

    const adjustedServiceTotal = SERVICE_ORDER.reduce((total, cat) => {
      const items = serviceSectionItems.get(cat) ?? [];
      const ownerSection = offerSections.find(s => s.category === cat);
      return total + items.reduce((s, item) => {
        const base = item.amount * item.quantity;
        return s + base + (ownerSection ? lineAdj(item, ownerSection) : 0);
      }, 0);
    }, 0);
    const rawTotal = Array.from(gpCatTotals.values()).reduce((a, b) => a + b, 0) + adjustedServiceTotal;
    const discount = grandTotal - rawTotal;

    // ── Build email HTML ──
    const materialsHtml = gpSortedCats.length > 0 ? `
      <div style="margin-bottom:20px">
        <div style="background:#e2520a;color:white;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding:6px 12px;border-radius:4px 4px 0 0">Materialer</div>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="text-align:left;padding:7px 12px;border:1px solid #e5e7eb">Kategori</th>
              <th style="text-align:right;padding:7px 12px;border:1px solid #e5e7eb">Ekskl. MVA</th>
              <th style="text-align:right;padding:7px 12px;border:1px solid #e5e7eb">Inkl. MVA</th>
            </tr>
          </thead>
          <tbody>
            ${gpSortedCats.map(([cat, total]) => `
              <tr>
                <td style="padding:7px 12px;border:1px solid #e5e7eb">${cat}</td>
                <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right">${formatNOK(total / 1.25)}</td>
                <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right">${formatNOK(total)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        ${sectionNotes.get("materialpakke") ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280">${sectionNotes.get("materialpakke")!.replace(/\n/g, "<br>")}</p>` : ""}
      </div>` : "";

    const SERVICE_LABELS: Record<string, string> = {
      søknadshjelp: "Søknadshjelp",
      prefabelement: "Prefabelement",
      grunnarbeid: "Grunnarbeid og støping",
    };

    const serviceBlocksHtml = SERVICE_ORDER
      .filter(cat => serviceSectionTotals.has(cat))
      .map(cat => {
        const items = serviceSectionItems.get(cat) ?? [];
        const ownerSection = offerSections.find(s => s.category === cat);
        const rowsHtml = items.map(item => {
          const base = item.amount * item.quantity;
          const adj = ownerSection ? lineAdj(item, ownerSection) : 0;
          const net = base + adj;
          const rabattDesc = item.rabatt_description
            ?? (!item.no_rabatt ? ownerSection?.rabatt_description : undefined);
          const descHtml = rabattDesc
            ? `${item.description}<br><span style="font-size:12px;color:#16a34a;font-style:italic">Rabatt: ${rabattDesc}</span>`
            : item.description;
          return `<tr>
            <td style="padding:7px 12px;border:1px solid #e5e7eb">${descHtml}</td>
            <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right">${formatNOK(net / 1.25)}</td>
            <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right">${formatNOK(net)}</td>
          </tr>`;
        }).join("");
        return `
        <div style="margin-bottom:20px">
          <div style="background:#e2520a;color:white;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding:6px 12px;border-radius:4px 4px 0 0">${SERVICE_LABELS[cat]}</div>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="text-align:left;padding:7px 12px;border:1px solid #e5e7eb">Beskrivelse</th>
                <th style="text-align:right;padding:7px 12px;border:1px solid #e5e7eb">Ekskl. MVA</th>
                <th style="text-align:right;padding:7px 12px;border:1px solid #e5e7eb">Inkl. MVA</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${sectionNotes.get(cat) ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280">${sectionNotes.get(cat)!.replace(/\n/g, "<br>")}</p>` : ""}
        </div>`;
      }).join("");

    const discountRowHtml = Math.abs(discount) >= 1 ? `
      <div style="display:flex;justify-content:space-between;padding:8px 16px;background:#f0fdf4;color:#16a34a;font-style:italic;font-size:14px">
        <span>${discount < 0 ? "Rabatt" : "Påslag"}</span>
        <span>${discount < 0 ? "−" : "+"}${formatNOK(Math.abs(discount))}</span>
      </div>` : "";

    const sectionsHtml = materialsHtml + serviceBlocksHtml;

    const paymentSection = `<p style="margin-top:20px;color:#374151">Ta kontakt med oss for å gjennomføre betalingen: <a href="mailto:post@garasjeproffen.no">post@garasjeproffen.no</a></p>`;

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#e2520a">Tilbud fra GarasjeProffen</h2>
        <p>Hei ${customerName},</p>
        <p>Takk for din henvendelse. Her er tilbudet ditt (${ticketNumber}):</p>

        ${sectionsHtml}

        ${gpSortedCats.length > 0 || serviceSectionTotals.size > 0 ? `
        <div style="margin-top:4px;border:2px solid #e2520a;border-radius:8px;overflow:hidden">
          ${discountRowHtml}
          <div style="background:#f8f7f5;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#374151">
            <span>Totalt ekskl. MVA</span>
            <span>${formatNOK(grandTotal / 1.25)}</span>
          </div>
          <div style="background:#f8f7f5;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#6b7280;border-top:1px solid #e5e7eb">
            <span>MVA 25 %</span>
            <span>${formatNOK(grandTotal * 0.2)}</span>
          </div>
          <div style="background:#fff7ed;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #fed7aa">
            <span style="font-weight:600;font-size:15px;color:#374151">Totalt inkl. MVA</span>
            <span style="font-weight:700;font-size:18px;color:#ea580c">${formatNOK(grandTotal)}</span>
          </div>
        </div>` : ""}

        ${paymentSection}

        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
        <p style="color:#6b7280;font-size:13px">GarasjeProffen AS · post@garasjeproffen.no · garasjeproffen.no</p>
      </div>
    `;

    // ── Generate PDF ──
    let pdfBuffer: Buffer | undefined;
    try {
      const materialGroups = gpSortedCats.map(([category, totalInclVat]) => ({ category, totalInclVat }));
      const serviceGroups = SERVICE_ORDER
        .filter(cat => serviceSectionItems.has(cat))
        .map(cat => ({
          label: SERVICE_LABELS[cat] ?? cat,
          items: (serviceSectionItems.get(cat) ?? []).map(item => {
            const ownerSection = offerSections.find(s => s.category === cat);
            const base = item.amount * item.quantity;
            const adj = ownerSection ? lineAdj(item, ownerSection) : 0;
            const rabattDesc = item.rabatt_description ?? (!item.no_rabatt ? ownerSection?.rabatt_description : undefined);
            return { description: item.description, totalInclVat: base + adj, rabattDesc };
          }),
        }));
      pdfBuffer = await generateQuotePdf({
        ticketNumber,
        customerName,
        tilbudsbeskrivelse,
        materialGroups,
        serviceGroups,
        discount,
        grandTotal,
      });
    } catch (pdfErr) {
      console.error("PDF generation failed, sending email without attachment:", pdfErr);
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: customerEmail,
        subject: `Tilbud fra GarasjeProffen – ${ticketNumber}`,
        html: emailHtml,
        attachments: pdfBuffer
          ? [{ filename: `tilbud-${ticketNumber}.pdf`, content: pdfBuffer }]
          : undefined,
      });
    }

    // ── Update quote in DB ──
    await sb.from("quotes").update({
      offer_sections: offerSections,
      offer_line_items: allLineItems,
      offer_total: grandTotal,
      offer_notes: offerSections.map(s => s.notes).filter(Boolean).join("\n\n") || null,
      status: "offer_sent",
      offer_sent_at: new Date().toISOString(),
    }).eq("id", quoteId);

    return NextResponse.json({ success: true, offerTotal: grandTotal });
  } catch (err) {
    console.error("send-offer error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt" }, { status: 500 });
  }
}
