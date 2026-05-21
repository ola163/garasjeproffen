import PDFDocument from "pdfkit";

const ORANGE = "#e2520a";
const DARK = "#111827";
const GRAY = "#6b7280";
const BORDER = "#e5e7eb";

function fmtNOK(n: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(n);
}

export interface QuotePdfMaterialGroup {
  category: string;
  totalInclVat: number;
}

export interface QuotePdfServiceItem {
  description: string;
  totalInclVat: number;
  rabattDesc?: string;
}

export interface QuotePdfServiceGroup {
  label: string;
  items: QuotePdfServiceItem[];
}

export interface QuotePdfData {
  ticketNumber: string;
  customerName: string;
  tilbudsbeskrivelse?: string | null;
  materialGroups: QuotePdfMaterialGroup[];
  serviceGroups: QuotePdfServiceGroup[];
  discount: number;
  grandTotal: number;
}

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, left: 50, right: 50, bottom: 70 },
      info: { Title: `Tilbud – ${data.ticketNumber}`, Author: "GarasjeProffen AS" },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;
    const M = 50;
    const CW = PW - 2 * M;
    const dateStr = new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

    // ── HEADER ──
    doc.rect(0, 0, PW, 80).fill(ORANGE);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(20)
      .text("GarasjeProffen", M, 18, { lineBreak: false });
    doc.fillColor("#ffedd5").font("Helvetica").fontSize(10)
      .text("Tilbud på garasjeprosjekt", M, 46, { lineBreak: false });
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(11)
      .text(data.ticketNumber, M, 18, { width: CW, align: "right", lineBreak: false });
    doc.fillColor("#ffedd5").font("Helvetica").fontSize(10)
      .text(dateStr, M, 36, { width: CW, align: "right", lineBreak: false });

    doc.y = 100;

    // ── KUNDE ──
    doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8).text("KUNDE", M, doc.y);
    doc.y += 10;
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(12).text(data.customerName, M, doc.y);
    doc.y += 24;
    doc.rect(M, doc.y, CW, 0.5).fill(BORDER);
    doc.y += 14;

    // ── TILBUDSBESKRIVELSE ──
    if (data.tilbudsbeskrivelse?.trim()) {
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8).text("TILBUDSBESKRIVELSE", M, doc.y);
      doc.y += 10;
      doc.fillColor(DARK).font("Helvetica").fontSize(10)
        .text(data.tilbudsbeskrivelse.trim(), M, doc.y, { width: CW });
      doc.y += doc.currentLineHeight() * (data.tilbudsbeskrivelse.trim().split("\n").length) + 20;
      doc.rect(M, doc.y, CW, 0.5).fill(BORDER);
      doc.y += 14;
    }

    const AMT_W = 110;
    const DESC_W = CW - AMT_W;
    const ROW_H = 22;

    function sectionHeader(label: string) {
      // Check if we need a new page
      if (doc.y > doc.page.height - 150) doc.addPage();
      doc.rect(M, doc.y, CW, ROW_H).fill(ORANGE);
      doc.fillColor("#fff").font("Helvetica-Bold").fontSize(10)
        .text(label, M + 8, doc.y + 6, { width: DESC_W - 16, lineBreak: false });
      doc.fillColor("#ffedd5").font("Helvetica-Bold").fontSize(8)
        .text("inkl. MVA", M + DESC_W, doc.y + 9, { width: AMT_W - 8, align: "right", lineBreak: false });
      doc.y += ROW_H;
    }

    function tableHeaderRow(col1: string, col2: string) {
      doc.rect(M, doc.y, CW, ROW_H - 4).fill("#f3f4f6");
      doc.rect(M, doc.y, CW, ROW_H - 4).lineWidth(0.5).stroke(BORDER);
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8)
        .text(col1, M + 8, doc.y + 5, { width: DESC_W - 16, lineBreak: false });
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8)
        .text(col2, M + DESC_W, doc.y + 5, { width: AMT_W - 8, align: "right", lineBreak: false });
      doc.y += ROW_H - 4;
    }

    let rowIdx = 0;
    function dataRow(col1: string, col2: string, subtext?: string) {
      if (doc.y > doc.page.height - 100) doc.addPage();
      const extra = subtext ? 12 : 0;
      const bg = rowIdx % 2 === 0 ? "#ffffff" : "#f9fafb";
      doc.rect(M, doc.y, CW, ROW_H + extra).fill(bg);
      doc.rect(M, doc.y, CW, ROW_H + extra).lineWidth(0.5).stroke(BORDER);
      doc.fillColor(DARK).font("Helvetica").fontSize(9)
        .text(col1, M + 8, doc.y + 6, { width: DESC_W - 16, lineBreak: false });
      doc.fillColor(DARK).font("Helvetica").fontSize(9)
        .text(col2, M + DESC_W, doc.y + 6, { width: AMT_W - 8, align: "right", lineBreak: false });
      if (subtext) {
        doc.fillColor("#16a34a").font("Helvetica").fontSize(8)
          .text(subtext, M + 8, doc.y + 18, { width: DESC_W - 16, lineBreak: false });
      }
      doc.y += ROW_H + extra;
      rowIdx++;
    }

    // ── MATERIALS ──
    if (data.materialGroups.length > 0) {
      sectionHeader("Materialer");
      tableHeaderRow("Kategori", "Ekskl. MVA / Inkl. MVA");
      for (const g of data.materialGroups) {
        dataRow(g.category, `${fmtNOK(g.totalInclVat / 1.25)}  /  ${fmtNOK(g.totalInclVat)}`);
      }
      doc.y += 12;
    }

    // ── SERVICE GROUPS ──
    for (const grp of data.serviceGroups) {
      sectionHeader(grp.label);
      tableHeaderRow("Beskrivelse", "Ekskl. MVA / Inkl. MVA");
      for (const item of grp.items) {
        dataRow(
          item.description,
          `${fmtNOK(item.totalInclVat / 1.25)}  /  ${fmtNOK(item.totalInclVat)}`,
          item.rabattDesc ? `Rabatt: ${item.rabattDesc}` : undefined,
        );
      }
      doc.y += 12;
    }

    // ── TOTALS ──
    if (doc.y > doc.page.height - 180) doc.addPage();
    doc.rect(M, doc.y, CW, 0.5).fill(BORDER);
    doc.y += 14;

    const TOTAL_ROW_H = 22;
    if (Math.abs(data.discount) >= 1) {
      const label = data.discount < 0 ? "Rabatt" : "Påslag";
      doc.rect(M, doc.y, CW, TOTAL_ROW_H).fill("#f0fdf4");
      doc.fillColor("#16a34a").font("Helvetica").fontSize(10)
        .text(label, M + 8, doc.y + 6, { width: DESC_W - 16, lineBreak: false });
      doc.fillColor("#16a34a").font("Helvetica").fontSize(10)
        .text(`${data.discount < 0 ? "−" : "+"}${fmtNOK(Math.abs(data.discount))}`, M + DESC_W, doc.y + 6, { width: AMT_W - 8, align: "right", lineBreak: false });
      doc.y += TOTAL_ROW_H;
    }

    // Ex VAT row
    doc.rect(M, doc.y, CW, TOTAL_ROW_H).fill("#f8f7f5");
    doc.fillColor(GRAY).font("Helvetica").fontSize(10)
      .text("Totalt ekskl. MVA", M + 8, doc.y + 6, { width: DESC_W - 16, lineBreak: false });
    doc.fillColor(DARK).font("Helvetica").fontSize(10)
      .text(fmtNOK(data.grandTotal / 1.25), M + DESC_W, doc.y + 6, { width: AMT_W - 8, align: "right", lineBreak: false });
    doc.y += TOTAL_ROW_H;

    // VAT row
    doc.rect(M, doc.y, CW, TOTAL_ROW_H).fill("#f8f7f5");
    doc.rect(M, doc.y, CW, TOTAL_ROW_H).lineWidth(0.5).stroke(BORDER);
    doc.fillColor(GRAY).font("Helvetica").fontSize(10)
      .text("MVA 25 %", M + 8, doc.y + 6, { width: DESC_W - 16, lineBreak: false });
    doc.fillColor(DARK).font("Helvetica").fontSize(10)
      .text(fmtNOK(data.grandTotal * 0.2), M + DESC_W, doc.y + 6, { width: AMT_W - 8, align: "right", lineBreak: false });
    doc.y += TOTAL_ROW_H;

    // Grand total
    const GT_H = TOTAL_ROW_H + 8;
    doc.rect(M, doc.y, CW, GT_H).fill("#fff7ed");
    doc.rect(M, doc.y, CW, GT_H).lineWidth(1.5).stroke(ORANGE);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text("Totalt inkl. MVA", M + 8, doc.y + 10, { width: DESC_W - 16, lineBreak: false });
    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(15)
      .text(fmtNOK(data.grandTotal), M + DESC_W, doc.y + 8, { width: AMT_W - 8, align: "right", lineBreak: false });
    doc.y += GT_H + 16;

    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
      .text("Ta kontakt for å gjennomføre betaling: post@garasjeproffen.no", M, doc.y, { width: CW });

    // ── FOOTER ──
    const FY = doc.page.height - 60;
    doc.rect(0, FY, PW, 60).fill("#f9fafb");
    doc.rect(0, FY, PW, 0.5).fill(BORDER);
    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
      .text("GarasjeProffen AS · Gangstøvegen 9, 4344 Bryne", M, FY + 12, { width: CW, align: "center", lineBreak: false });
    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
      .text("post@garasjeproffen.no  ·  Christian: +47 476 17 563  ·  Ola: +47 913 44 486", M, FY + 28, { width: CW, align: "center", lineBreak: false });

    doc.end();
  });
}
