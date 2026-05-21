import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import AutoPrint from "./AutoPrint";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function nok(n: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

function exclMva(n: number) { return n / 1.25; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function SoknadshjelPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  const { data } = await sb
    .from("soknadshjelp")
    .select("ticket_number,customer_name,customer_email,customer_phone,address,permit_price,permit_result,extra_costs,manual_dispensasjoner,customer_notes,assigned_to,created_at,dibk")
    .eq("id", id)
    .single();
  if (!data) notFound();

  const extraCosts = (data.extra_costs as { description: string; amount: number }[]) ?? [];
  const manualDisps = (data.manual_dispensasjoner as { description: string; amount: number }[]) ?? [];

  const DISP_KEYS = ["frittstående", "bya50", "enEtasje", "monehoyde", "nabogrense", "avstandBygg", "ikkeVernet", "ikkeFlom"];
  const dibk = (data.dibk as Record<string, string> | null) ?? {};
  const dibkDispCount = Object.entries(dibk).filter(([k, v]) =>
    k === "lnf" ? v === "Ja" : DISP_KEYS.includes(k) && v === "Nei"
  ).length;
  const permitPrice = (data.permit_price as number) ?? 0;
  const grandTotal = permitPrice + manualDisps.reduce((s, d) => s + d.amount, 0) + extraCosts.reduce((s, c) => s + c.amount, 0);
  const today = formatDate(new Date().toISOString());

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: white; }
        @page { size: A4; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          header, footer, nav, aside { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { padding: 18mm 18mm 22mm 18mm; max-width: 100%; margin: 0; }
        }
        .page { max-width: 800px; margin: 0 auto; padding: 32px; }
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 18px; border-bottom: 3px solid #e2520a; }
        .header-meta { text-align: right; font-size: 9pt; color: #555; line-height: 1.6; }
        .header-meta strong { font-size: 11pt; color: #1a1a1a; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
        .info-box { background: #f8f7f5; border-radius: 6px; padding: 14px 16px; }
        .info-box h3 { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 8px; }
        .info-row { display: flex; gap: 8px; margin-bottom: 3px; font-size: 10pt; }
        .info-label { color: #666; min-width: 80px; }
        .info-value { color: #1a1a1a; font-weight: 500; }
        .section { margin-bottom: 20px; page-break-inside: avoid; }
        .section-header { background: #e2520a; color: white; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 12px; border-radius: 4px 4px 0 0; }
        table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        thead th { background: #f3f2ef; padding: 6px 8px; text-align: left; font-size: 8pt; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e0ddd8; }
        thead th.right { text-align: right; }
        tbody td { padding: 5px 8px; border-bottom: 1px solid #f0ede8; vertical-align: top; }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background: #faf9f7; }
        td.right { text-align: right; white-space: nowrap; }
        .notes { margin-top: 6px; padding: 8px 10px; background: #fffbf5; border-left: 3px solid #e2520a; border-radius: 0 4px 4px 0; font-size: 9pt; color: #555; }
        .total-box { margin-top: 24px; margin-left: auto; width: 280px; border: 2px solid #e2520a; border-radius: 6px; overflow: hidden; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 10pt; }
        .total-row.grand { background: #e2520a; color: white; font-size: 13pt; font-weight: 800; padding: 12px 16px; }
        .doc-footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e0ddd8; display: flex; justify-content: space-between; font-size: 8pt; color: #888; }
      `}</style>

      <div className="page">
        <AutoPrint backHref={`/admin/soknadshjelp/${id}`} />

        {/* Header */}
        <div className="doc-header">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-header.jpg" alt="GarasjeProffen" style={{ height: 96, width: "auto", display: "block", marginBottom: 6 }} />
            <div style={{ fontSize: "9pt", color: "#888", lineHeight: 1.6 }}>
              Tjødnavegen 8b, 4342 Bryne<br />
              post@garasjeproffen.no<br />
              Org.nr. 937 606 966
            </div>
          </div>
          <div className="header-meta">
            <strong>TILBUD – SØKNADSHJELP</strong><br />
            Referanse: <strong>{data.ticket_number}</strong><br />
            Dato: {today}<br />
            {data.assigned_to && <>Saksbehandler: {data.assigned_to}</>}
          </div>
        </div>

        {/* Customer + details */}
        <div className="info-grid">
          <div className="info-box">
            <h3>Kunde</h3>
            <div className="info-row"><span className="info-label">Navn</span><span className="info-value">{data.customer_name}</span></div>
            <div className="info-row"><span className="info-label">E-post</span><span className="info-value">{data.customer_email}</span></div>
            {data.customer_phone && <div className="info-row"><span className="info-label">Telefon</span><span className="info-value">{data.customer_phone}</span></div>}
            {data.address && <div className="info-row"><span className="info-label">Adresse</span><span className="info-value">{data.address}</span></div>}
          </div>
          <div className="info-box">
            <h3>Søknad</h3>
            <div className="info-row"><span className="info-label">Type</span><span className="info-value">Søknadshjelp</span></div>
            {data.permit_result && <div className="info-row"><span className="info-label">Resultat</span><span className="info-value" style={{ textTransform: "capitalize" }}>{data.permit_result}</span></div>}
          </div>
        </div>

        {/* Søknadshjelp section */}
        {permitPrice > 0 && (
          <div className="section">
            <div className="section-header">Søknadshjelp</div>
            <table>
              <thead>
                <tr>
                  <th>Beskrivelse</th>
                  <th className="right" style={{ width: 110 }}>Ekskl. MVA</th>
                  <th className="right" style={{ width: 110 }}>Inkl. MVA</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Søknadshjelp
                    {dibkDispCount > 0 && (
                      <span style={{ marginLeft: 8, fontSize: "8.5pt", color: "#666" }}>
                        (inkl. {dibkDispCount} dispensasjon{dibkDispCount > 1 ? "er" : ""})
                      </span>
                    )}
                  </td>
                  <td className="right">{nok(exclMva(permitPrice))}</td>
                  <td className="right">{nok(permitPrice)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Dispensasjoner */}
        {manualDisps.length > 0 && (
          <div className="section">
            <div className="section-header">Dispensasjoner</div>
            <table>
              <thead>
                <tr>
                  <th>Beskrivelse</th>
                  <th className="right" style={{ width: 110 }}>Ekskl. MVA</th>
                  <th className="right" style={{ width: 110 }}>Inkl. MVA</th>
                </tr>
              </thead>
              <tbody>
                {manualDisps.map((d, i) => (
                  <tr key={i}>
                    <td>{d.description}</td>
                    <td className="right">{nok(exclMva(d.amount))}</td>
                    <td className="right">{nok(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tegninger og andre kostnader */}
        {extraCosts.length > 0 && (
          <div className="section">
            <div className="section-header">Tegninger og andre kostnader</div>
            <table>
              <thead>
                <tr>
                  <th>Beskrivelse</th>
                  <th className="right" style={{ width: 110 }}>Ekskl. MVA</th>
                  <th className="right" style={{ width: 110 }}>Inkl. MVA</th>
                </tr>
              </thead>
              <tbody>
                {extraCosts.map((c, i) => (
                  <tr key={i}>
                    <td>{c.description}</td>
                    <td className="right">{nok(exclMva(c.amount))}</td>
                    <td className="right">{nok(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Grand total */}
        {grandTotal > 0 && (
          <div className="total-box">
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

        {/* Customer notes */}
        {data.customer_notes && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: "8pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#888", marginBottom: 6 }}>Notat til kunde</div>
            <div className="notes">{data.customer_notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="doc-footer">
          <span>GarasjeProffen AS · Tjødnavegen 8b, 4342 Bryne · Org.nr. 937 606 966</span>
          <span>post@garasjeproffen.no · garasjeproffen.no</span>
        </div>
      </div>
    </>
  );
}
