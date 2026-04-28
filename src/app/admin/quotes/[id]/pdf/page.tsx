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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" });
}

const CAT_LABELS: Record<string, string> = {
  søknadshjelp: "Søknadshjelp",
  materialpakke: "Materialpakke",
  prefabelement: "Prefabelement",
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

function computeTotal(sections: OfferSection[]): number {
  const hasPrefa  = sections.some((s) => s.category === "prefabelement");
  const hasMatpak = sections.some((s) => s.category === "materialpakke");
  return sections.reduce((total, sec) => {
    if (hasPrefa  && sec.category === "materialpakke") return total;
    if ((hasPrefa || hasMatpak) && sec.category === "søknadshjelp") return total;
    return total + getEffectiveItems(sec, sections).reduce((s, i) => s + (i.amount || 0) * (i.quantity || 1), 0);
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

        {/* Offer sections */}
        {sections.length === 0 && (
          <p style={{ color: "#888", fontStyle: "italic" }}>Ingen tilbudslinjer er lagt til ennå.</p>
        )}

        {sections.map((section, sIdx) => {
          const hasPrefa  = sections.some((s) => s.category === "prefabelement");
          const hasMatpak = sections.some((s) => s.category === "materialpakke");
          const isHidden  = (hasPrefa && section.category === "materialpakke") || ((hasPrefa || hasMatpak) && section.category === "søknadshjelp");
          if (isHidden) return null;

          const effective = getEffectiveItems(section, sections);
          const sectionTotal = effective.reduce((s, i) => s + (i.amount || 0) * (i.quantity || 1), 0);

          const sokItems  = (section.category === "materialpakke" || section.category === "prefabelement") ? (sections.find((s) => s.category === "søknadshjelp")?.line_items ?? []) : [];
          const matItems  = section.category === "prefabelement" ? (sections.find((s) => s.category === "materialpakke")?.line_items ?? []) : [];
          const ownItems  = section.line_items;

          const isMat = section.category === "materialpakke";

          return (
            <div key={sIdx} className="section">
              <div className="section-header">{CAT_LABELS[section.category] ?? section.category}</div>
              <table>
                <thead>
                  <tr>
                    {isMat && <th style={{ width: 72 }}>Varenr</th>}
                    <th>Beskrivelse</th>
                    {isMat && <th style={{ width: 80 }}>Dimensjon</th>}
                    <th className="right" style={{ width: 50 }}>Enhet</th>
                    <th className="right" style={{ width: 52 }}>Ant.</th>
                    <th className="right" style={{ width: 90 }}>Pris/enhet</th>
                    <th className="right" style={{ width: 90 }}>Sum</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Inherited søknadshjelp rows */}
                  {sokItems.map((item, i) => (
                    <tr key={`sok-${i}`} className="inherited">
                      {isMat && <td className="muted">–</td>}
                      <td>{item.description || "–"}</td>
                      {isMat && <td className="muted">{item.dimensjon ?? ""}</td>}
                      <td className="right muted">{item.enhet ?? ""}</td>
                      <td className="right muted">{item.quantity}</td>
                      <td className="right muted">{item.amount ? nok(item.amount) : "–"}</td>
                      <td className="right muted">{item.amount ? nok(item.amount * item.quantity) : "–"}</td>
                    </tr>
                  ))}
                  {/* Inherited materialpakke rows (prefabelement) */}
                  {matItems.map((item, i) => (
                    <tr key={`mat-${i}`} className="inherited">
                      {isMat && <td className="muted">–</td>}
                      <td>{item.description || "–"}</td>
                      {isMat && <td className="muted">{item.dimensjon ?? ""}</td>}
                      <td className="right muted">{item.enhet ?? ""}</td>
                      <td className="right muted">{item.quantity}</td>
                      <td className="right muted">{item.amount ? nok(item.amount) : "–"}</td>
                      <td className="right muted">{item.amount ? nok(item.amount * item.quantity) : "–"}</td>
                    </tr>
                  ))}
                  {/* Own line items */}
                  {ownItems.map((item, i) => (
                    <tr key={`own-${i}`}>
                      {isMat && <td className="muted">{item.varenr ?? ""}</td>}
                      <td>{item.description || "–"}</td>
                      {isMat && <td className="muted">{item.dimensjon ?? ""}</td>}
                      <td className="right">{item.enhet ?? ""}</td>
                      <td className="right">{item.quantity}</td>
                      <td className="right">{item.amount ? nok(item.amount) : "–"}</td>
                      <td className="right">{item.amount ? nok(item.amount * item.quantity) : "–"}</td>
                    </tr>
                  ))}
                  {/* Subtotal */}
                  <tr className="subtotal-row">
                    {isMat && <td />}
                    <td colSpan={isMat ? 4 : 4} style={{ textAlign: "right", paddingRight: 8 }}>
                      Sum {CAT_LABELS[section.category] ?? section.category}
                    </td>
                    <td className="right" colSpan={2}>{nok(sectionTotal)}</td>
                  </tr>
                </tbody>
              </table>
              {section.notes && <div className="notes">{section.notes}</div>}
            </div>
          );
        })}

        {/* Grand total */}
        {sections.length > 0 && (
          <div className="total-box">
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
