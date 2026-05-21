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

export interface SoknadshjelPdfData {
  ticketNumber: string;
  customerName: string;
  address?: string | null;
  tilbudsbeskrivelse?: string | null;
  permitPrice: number;
  extraCosts: { description: string; amount: number }[];
  manualDisps: { description: string; amount: number }[];
}

export async function generateSoknadshjelPdf(data: SoknadshjelPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, left: 50, right: 50, bottom: 70 },
      info: { Title: `Tilbud – Søknadshjelp – ${data.ticketNumber}`, Author: "GarasjeProffen AS" },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;
    const M = 50;
    const CW = PW - 2 * M;
    const AMT_W = 110;
    const DESC_W = CW - AMT_W;
    const ROW_H = 22;
    const dateStr = new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

    // ── helpers (identical to quote-pdf) ──────────────────────────────────

    function sectionHeader(label: string) {
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
    function dataRow(col1: string, col2: string) {
      if (doc.y > doc.page.height - 100) doc.addPage();
      const bg = rowIdx % 2 === 0 ? "#ffffff" : "#f9fafb";
      doc.rect(M, doc.y, CW, ROW_H).fill(bg);
      doc.rect(M, doc.y, CW, ROW_H).lineWidth(0.5).stroke(BORDER);
      doc.fillColor(DARK).font("Helvetica").fontSize(9)
        .text(col1, M + 8, doc.y + 6, { width: DESC_W - 16, lineBreak: false });
      doc.fillColor(DARK).font("Helvetica").fontSize(9)
        .text(col2, M + DESC_W, doc.y + 6, { width: AMT_W - 8, align: "right", lineBreak: false });
      doc.y += ROW_H;
      rowIdx++;
    }

    // ── HEADER ───────────────────────────────────────────────────────────

    doc.rect(0, 0, PW, 80).fill(ORANGE);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(20)
      .text("GarasjeProffen", M, 18, { lineBreak: false });
    doc.fillColor("#ffedd5").font("Helvetica").fontSize(10)
      .text("Søknadshjelp – Tilbud", M, 46, { lineBreak: false });
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(11)
      .text(data.ticketNumber, M, 18, { width: CW, align: "right", lineBreak: false });
    doc.fillColor("#ffedd5").font("Helvetica").fontSize(10)
      .text(dateStr, M, 36, { width: CW, align: "right", lineBreak: false });

    doc.y = 100;

    // ── KUNDE ────────────────────────────────────────────────────────────

    doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8).text("KUNDE", M, doc.y);
    doc.y += 10;
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(12).text(data.customerName, M, doc.y);
    if (data.address) {
      doc.y += 16;
      doc.fillColor(GRAY).font("Helvetica").fontSize(10).text(data.address, M, doc.y);
    }
    doc.y += 24;
    doc.rect(M, doc.y, CW, 0.5).fill(BORDER);
    doc.y += 14;

    // ── TILBUDSBESKRIVELSE ───────────────────────────────────────────────

    if (data.tilbudsbeskrivelse?.trim()) {
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8).text("TILBUDSBESKRIVELSE", M, doc.y);
      doc.y += 10;
      doc.fillColor(DARK).font("Helvetica").fontSize(10)
        .text(data.tilbudsbeskrivelse.trim(), M, doc.y, { width: CW });
      doc.y += doc.currentLineHeight() * (data.tilbudsbeskrivelse.trim().split("\n").length) + 20;
      doc.rect(M, doc.y, CW, 0.5).fill(BORDER);
      doc.y += 14;
    }

    // ── PRICE SECTIONS ───────────────────────────────────────────────────

    if (data.permitPrice > 0) {
      sectionHeader("Søknadshjelp");
      tableHeaderRow("Beskrivelse", "Ekskl. MVA / Inkl. MVA");
      dataRow("Søknadshjelp", `${fmtNOK(data.permitPrice / 1.25)}  /  ${fmtNOK(data.permitPrice)}`);
      doc.y += 12;
    }

    if (data.manualDisps.length > 0) {
      sectionHeader("Dispensasjoner");
      tableHeaderRow("Beskrivelse", "Ekskl. MVA / Inkl. MVA");
      for (const d of data.manualDisps) {
        dataRow(d.description, `${fmtNOK(d.amount / 1.25)}  /  ${fmtNOK(d.amount)}`);
      }
      doc.y += 12;
    }

    if (data.extraCosts.length > 0) {
      sectionHeader("Tegninger og andre kostnader");
      tableHeaderRow("Beskrivelse", "Ekskl. MVA / Inkl. MVA");
      for (const c of data.extraCosts) {
        dataRow(c.description, `${fmtNOK(c.amount / 1.25)}  /  ${fmtNOK(c.amount)}`);
      }
      doc.y += 12;
    }

    // ── TOTALS (identical structure to quote-pdf) ─────────────────────────

    const grandTotal =
      data.permitPrice +
      data.manualDisps.reduce((s, d) => s + d.amount, 0) +
      data.extraCosts.reduce((s, c) => s + c.amount, 0);

    if (doc.y > doc.page.height - 180) doc.addPage();
    doc.rect(M, doc.y, CW, 0.5).fill(BORDER);
    doc.y += 14;

    const TR_H = 22;

    // Ex VAT
    doc.rect(M, doc.y, CW, TR_H).fill("#f8f7f5");
    doc.fillColor(GRAY).font("Helvetica").fontSize(10)
      .text("Totalt ekskl. MVA", M + 8, doc.y + 6, { width: DESC_W - 16, lineBreak: false });
    doc.fillColor(DARK).font("Helvetica").fontSize(10)
      .text(fmtNOK(grandTotal / 1.25), M + DESC_W, doc.y + 6, { width: AMT_W - 8, align: "right", lineBreak: false });
    doc.y += TR_H;

    // VAT
    doc.rect(M, doc.y, CW, TR_H).fill("#f8f7f5");
    doc.rect(M, doc.y, CW, TR_H).lineWidth(0.5).stroke(BORDER);
    doc.fillColor(GRAY).font("Helvetica").fontSize(10)
      .text("MVA 25 %", M + 8, doc.y + 6, { width: DESC_W - 16, lineBreak: false });
    doc.fillColor(DARK).font("Helvetica").fontSize(10)
      .text(fmtNOK(grandTotal * 0.2), M + DESC_W, doc.y + 6, { width: AMT_W - 8, align: "right", lineBreak: false });
    doc.y += TR_H;

    // Grand total
    const GT_H = TR_H + 8;
    doc.rect(M, doc.y, CW, GT_H).fill("#fff7ed");
    doc.rect(M, doc.y, CW, GT_H).lineWidth(1.5).stroke(ORANGE);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text("Totalt inkl. MVA", M + 8, doc.y + 10, { width: DESC_W - 16, lineBreak: false });
    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(15)
      .text(fmtNOK(grandTotal), M + DESC_W, doc.y + 8, { width: AMT_W - 8, align: "right", lineBreak: false });
    doc.y += GT_H + 16;

    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
      .text("Prisen er et estimat og kan justeres etter videre befaring og dialog.", M, doc.y, { width: CW });

    // ── FOOTER ───────────────────────────────────────────────────────────

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
