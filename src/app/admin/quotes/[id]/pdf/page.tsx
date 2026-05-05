import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import AutoPrint from "./AutoPrint";
import type { LineItem, OfferSection, QuoteRow } from "@/types/quote-admin";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function nok(n: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

function exclMva(n: number) { return n / 1.25; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" });
}

const SECTION_LABELS: Record<string, string> = {
  søknadshjelp: "Søknadshjelp",
  materialpakke: "Materialpakke",
  prefabelement: "Prefabelement",
  grunnarbeid: "Grunnarbeid og støping",
};

function getEffectiveItems(section: OfferSection, all: OfferSection[]): LineItem[] {
  const sok = all.find((s) => s.category === "søknadshjelp");
  const mat = all.find((s) => s.category === "materialpakke");
  if (section.category === "prefabelement") {
    return [...(sok?.line_items ?? []), ...(mat?.line_items ?? []), ...section.line_items];
  }
  if (section.category === "materialpakke") {
    return [...(sok?.line_items ?? []), ...section.line_items];
  }
  return section.line_items;
}

function adjNok(value: number | undefined, type: "kr" | "pst" | undefined, base: number) {
  if (!value) return 0;
  return type === "pst" ? base * value / 100 : value;
}

function lineAdj(item: LineItem, sec: OfferSection): number {
  const base = (item.amount || 0) * (item.quantity || 1);
  const useSec = !item.no_rabatt;
  const rVal = item.rabatt_value !== undefined ? item.rabatt_value : useSec ? sec.rabatt_value : undefined;
  const rType = item.rabatt_value !== undefined ? item.rabatt_type : useSec ? sec.rabatt_type : undefined;
  const pVal = item.påslag_value !== undefined ? item.påslag_value : useSec ? sec.påslag_value : undefined;
  const pType = item.påslag_value !== undefined ? item.påslag_type : useSec ? sec.påslag_type : undefined;
  return adjNok(pVal, pType, base) - adjNok(rVal, rType, base);
}

function computeTotal(sections: OfferSection[]): number {
  const hasPrefa  = sections.some((s) => s.category === "prefabelement");
  const hasMatpak = sections.some((s) => s.category === "materialpakke");
  const sok = sections.find((s) => s.category === "søknadshjelp");
  const sokAdj = sok ? sok.line_items.reduce((s, i) => s + lineAdj(i, sok), 0) : 0;

  return sections.reduce((total, sec) => {
    if (hasPrefa  && sec.category === "materialpakke") return total;
    if ((hasPrefa || hasMatpak) && sec.category === "søknadshjelp") return total;
    const lineTotal = getEffectiveItems(sec, sections).reduce((s, i) => s + (i.amount || 0) * (i.quantity || 1), 0);
    const adj = (sec.category === "materialpakke" || sec.category === "prefabelement")
      ? sokAdj + sec.line_items.reduce((s, i) => s + lineAdj(i, sec), 0)
      : sec.line_items.reduce((s, i) => s + lineAdj(i, sec), 0);
    return total + lineTotal + adj;
  }, 0);
}

export default async function QuotePdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  const { data } = await sb.from("quotes").select("*").eq("id", id).single();
  if (!data) notFound();

  const quote = data as QuoteRow;
  const sections: OfferSection[] = quote.offer_sections ?? [];
  const grandTotal = computeTotal(sections);
  const today = formatDate(new Date().toISOString());

  // Fetch GP product catalog categories for varenr lookup
  const allVarenrs = [...new Set(sections.flatMap(s => s.line_items.map(i => i.varenr).filter((v): v is string => !!v)))];
  const gpCatMap = new Map<string, string>();
  if (allVarenrs.length > 0) {
    const { data: prods } = await sb.from("gp_products").select("varenr, category").in("varenr", allVarenrs);
    for (const p of (prods ?? []) as { varenr: string; category: string }[]) gpCatMap.set(p.varenr, p.category);
  }
  const { data: rawCats } = await sb.from("gp_categories").select("label, sort_order").order("sort_order");
  const catSortOrder = new Map((rawCats ?? []).map((c: { label: string; sort_order: number }) => [c.label, c.sort_order]));

  // Split items: materialpakke → GP catalog categories, services → own section totals
  const hasPrefa  = sections.some(s => s.category === "prefabelement");
  const hasMatpak = sections.some(s => s.category === "materialpakke");
  const itemSectionCat = new Map<LineItem, string>();
  for (const s of sections) for (const i of s.line_items) itemSectionCat.set(i, s.category);

  const sectionNotes = new Map<string, string>();
  for (const sec of sections) {
    if (sec.notes?.trim()) sectionNotes.set(sec.category, sec.notes.trim());
  }

  const seenItems = new Set<LineItem>();
  const gpCatTotals = new Map<string, number>();
  const gpCatOrderMap = new Map<string, number>();
  const serviceSectionTotals = new Map<string, number>();
  const serviceSectionItems = new Map<string, LineItem[]>();

  for (const sec of sections) {
    if (hasPrefa  && sec.category === "materialpakke") continue;
    if ((hasPrefa || hasMatpak) && sec.category === "søknadshjelp") continue;
    for (const item of getEffectiveItems(sec, sections)) {
      if (seenItems.has(item)) continue;
      seenItems.add(item);
      const raw = (item.amount || 0) * (item.quantity || 1);
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

  // Use adjusted service totals in rawTotal to avoid double-counting with per-line adjusted display
  const adjustedServiceTotal = SERVICE_ORDER.reduce((total, cat) => {
    const items = serviceSectionItems.get(cat) ?? [];
    const ownerSection = sections.find(s => s.category === cat);
    return total + items.reduce((s, item) => {
      const base = (item.amount || 0) * (item.quantity || 1);
      return s + base + (ownerSection ? lineAdj(item, ownerSection) : 0);
    }, 0);
  }, 0);
  const rawTotal = Array.from(gpCatTotals.values()).reduce((a, b) => a + b, 0) + adjustedServiceTotal;
  const discount = grandTotal - rawTotal;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: white; }
        @page { size: A4; margin: 18mm 18mm 22mm 18mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .page { max-width: 800px; margin: 0 auto; padding: 32px; }
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 18px; border-bottom: 3px solid #e2520a; }
        .logo { font-size: 22pt; font-weight: 800; color: #e2520a; letter-spacing: -0.5px; }
        .logo span { color: #1a1a1a; }
        .header-meta { text-align: right; font-size: 9pt; color: #555; line-height: 1.6; }
        .header-meta strong { font-size: 11pt; color: #1a1a1a; }
        /* Offer title */
        .offer-title { font-size: 20pt; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
        .offer-sub { font-size: 10pt; color: #666; margin-bottom: 24px; }
        /* Two-col info */
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
        .info-box { background: #f8f7f5; border-radius: 6px; padding: 14px 16px; }
        .info-box h3 { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 8px; }
        .info-row { display: flex; gap: 8px; margin-bottom: 3px; font-size: 10pt; }
        .info-label { color: #666; min-width: 72px; }
        .info-value { color: #1a1a1a; font-weight: 500; }
        /* Section */
        .section { margin-bottom: 20px; page-break-inside: avoid; }
        .section-header { background: #e2520a; color: white; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 12px; border-radius: 4px 4px 0 0; }
        /* Table */
        table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        thead th { background: #f3f2ef; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e0ddd8; }
        thead th.right { text-align: right; }
        tbody td { padding: 5px 8px; border-bottom: 1px solid #f0ede8; vertical-align: top; }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background: #faf9f7; }
        td.right { text-align: right; white-space: nowrap; }
        td.muted { color: #888; font-size: 8.5pt; }
        .subtotal-row { background: #f8f7f5 !important; font-weight: 600; }
        .subtotal-row td { border-top: 1.5px solid #e0ddd8; padding-top: 7px; padding-bottom: 7px; }
        /* Inherited marker */
        .inherited td { color: #999; font-style: italic; font-size: 8.5pt; background: #fcfcfc !important; }
        /* Notes */
        .notes { margin-top: 6px; padding: 8px 10px; background: #fffbf5; border-left: 3px solid #e2520a; border-radius: 0 4px 4px 0; font-size: 9pt; color: #555; }
        /* Grand total */
        .total-box { margin-top: 24px; margin-left: auto; width: 280px; border: 2px solid #e2520a; border-radius: 6px; overflow: hidden; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 10pt; }
        .total-row.grand { background: #e2520a; color: white; font-size: 13pt; font-weight: 800; padding: 12px 16px; }
        /* Footer */
        .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e0ddd8; display: flex; justify-content: space-between; font-size: 8pt; color: #888; }
        /* Print button */
        .print-btn { display: inline-flex; align-items: center; gap-6px; margin-bottom: 24px; background: #e2520a; color: white; border: none; border-radius: 6px; padding: 9px 18px; font-size: 11pt; cursor: pointer; font-weight: 600; }
      `}</style>

      <div className="page">
        <AutoPrint backHref={`/admin/quotes/${id}`} />

        {/* Header */}
        <div className="header">
          <div>
            <div className="logo">Garasje<span>Proffen</span></div>
            <div style={{ fontSize: "9pt", color: "#888", marginTop: 4, lineHeight: 1.6 }}>
              Tjødnavegen 8b, 4342 Bryne<br />
              post@garasjeproffen.no<br />
              Org.nr. 937 606 966
            </div>
          </div>
          <div className="header-meta">
            <strong>TILBUD</strong><br />
            Referanse: <strong>{quote.ticket_number}</strong><br />
            Dato: {today}<br />
            {quote.offer_sent_at && <>Sendt: {formatDate(quote.offer_sent_at)}<br /></>}
            {quote.assigned_to && <>Saksbehandler: {quote.assigned_to}</>}
          </div>
        </div>

        {/* Customer info */}
        <div className="info-grid">
          <div className="info-box">
            <h3>Kunde</h3>
            <div className="info-row"><span className="info-label">Navn</span><span className="info-value">{quote.customer_name}</span></div>
            <div className="info-row"><span className="info-label">E-post</span><span className="info-value">{quote.customer_email}</span></div>
            {quote.customer_phone && <div className="info-row"><span className="info-label">Telefon</span><span className="info-value">{quote.customer_phone}</span></div>}
          </div>
          <div className="info-box">
            <h3>Produkt</h3>
            {quote.building_type && <div className="info-row"><span className="info-label">Type bygg</span><span className="info-value" style={{ textTransform: "capitalize" }}>{quote.building_type}</span></div>}
            {quote.package_type && <div className="info-row"><span className="info-label">Pakke</span><span className="info-value">{quote.package_type === "prefab" ? "Prefabrikert løsning" : "Materialpakke"}</span></div>}
            {quote.roof_type && <div className="info-row"><span className="info-label">Tak</span><span className="info-value">{quote.roof_type === "saltak" ? "Saltak" : "Flattak"}</span></div>}
            {(() => {
              const p = (quote.configuration as { parameters?: Record<string, number> } | null)?.parameters;
              if (!p) return null;
              return (
                <>
                  {p.width  && <div className="info-row"><span className="info-label">Bredde</span><span className="info-value">{p.width / 1000} m</span></div>}
                  {p.length && <div className="info-row"><span className="info-label">Lengde</span><span className="info-value">{p.length / 1000} m</span></div>}
                </>
              );
            })()}
          </div>
        </div>

        {/* Category summary */}
        {sections.length === 0 && (
          <p style={{ color: "#888", fontStyle: "italic" }}>Ingen tilbudslinjer er lagt til ennå.</p>
        )}

        {/* Materialer — GP catalog categories */}
        {gpSortedCats.length > 0 && (
          <div className="section">
            <div className="section-header">Materialer</div>
            <table>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th className="right" style={{ width: 110 }}>Ekskl. MVA</th>
                  <th className="right" style={{ width: 110 }}>Inkl. MVA</th>
                </tr>
              </thead>
              <tbody>
                {gpSortedCats.map(([cat, total]) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td className="right">{nok(exclMva(total))}</td>
                    <td className="right">{nok(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sectionNotes.get("materialpakke") && (
              <div className="notes">{sectionNotes.get("materialpakke")}</div>
            )}
          </div>
        )}

        {/* Service sections — each line shown individually */}
        {SERVICE_ORDER.filter(cat => serviceSectionTotals.has(cat)).map(cat => {
          const items = serviceSectionItems.get(cat) ?? [];
          const ownerSection = sections.find(s => s.category === cat);
          return (
            <div key={cat} className="section">
              <div className="section-header">{SECTION_LABELS[cat]}</div>
              <table>
                <thead>
                  <tr>
                    <th>Beskrivelse</th>
                    <th className="right" style={{ width: 110 }}>Ekskl. MVA</th>
                    <th className="right" style={{ width: 110 }}>Inkl. MVA</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const base = (item.amount || 0) * (item.quantity || 1);
                    const adj = ownerSection ? lineAdj(item, ownerSection) : 0;
                    const net = base + adj;
                    const rabattDesc = item.rabatt_description
                      ?? (!item.no_rabatt ? ownerSection?.rabatt_description : undefined);
                    return (
                      <tr key={idx}>
                        <td>
                          {item.description}
                          {rabattDesc && (
                            <div style={{ fontSize: "8pt", color: "#16a34a", fontStyle: "italic", marginTop: 2 }}>
                              Rabatt: {rabattDesc}
                            </div>
                          )}
                        </td>
                        <td className="right">{nok(exclMva(net))}</td>
                        <td className="right">{nok(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sectionNotes.get(cat) && (
                <div className="notes">{sectionNotes.get(cat)}</div>
              )}
            </div>
          );
        })}

        {/* Grand total */}
        {sections.length > 0 && (
          <div className="total-box">
            {Math.abs(discount) >= 1 && (
              <div className="total-row" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                <span style={{ fontStyle: "italic" }}>{discount < 0 ? "Rabatt" : "Påslag"}</span>
                <span>{discount < 0 ? "−" : "+"}{nok(Math.abs(discount))}</span>
              </div>
            )}
            <div className="total-row" style={{ background: "#f8f7f5" }}>
              <span>Totalt ekskl. MVA</span>
              <span>{nok(exclMva(grandTotal))}</span>
            </div>
            <div className="total-row" style={{ background: "#f8f7f5", color: "#666" }}>
              <span>MVA 25 %</span>
              <span>{nok(grandTotal * 0.2)}</span>
            </div>
            <div className="total-row grand">
              <span>Totalt inkl. MVA</span>
              <span>{nok(grandTotal)}</span>
            </div>
          </div>
        )}

        {/* Customer message */}
        {quote.customer_message && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: "8pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#888", marginBottom: 6 }}>Kundens melding</div>
            <div className="notes" style={{ borderColor: "#ccc", background: "#fafafa" }}>{quote.customer_message}</div>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <span>GarasjeProffen AS · Tjødnavegen 8b, 4342 Bryne · Org.nr. 937 606 966</span>
          <span>post@garasjeproffen.no · garasjeproffen.no</span>
        </div>
      </div>
    </>
  );
}
