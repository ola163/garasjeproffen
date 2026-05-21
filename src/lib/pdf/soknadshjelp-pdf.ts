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
    const dateStr = new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

    // ── HEADER ──
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

    // ── KUNDE ──
    doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8)
      .text("KUNDE", M, doc.y);
    doc.y += 10;
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(12)
      .text(data.customerName, M, doc.y);
    if (data.address) {
      doc.y += 16;
      doc.fillColor(GRAY).font("Helvetica").fontSize(10)
        .text(data.address, M, doc.y);
    }
    doc.y += 24;
    doc.rect(M, doc.y, CW, 0.5).fill(BORDER);
    doc.y += 14;

    // ── TILBUDSBESKRIVELSE ──
    if (data.tilbudsbeskrivelse?.trim()) {
      doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8)
        .text("TILBUDSBESKRIVELSE", M, doc.y);
      doc.y += 10;
      doc.fillColor(DARK).font("Helvetica").fontSize(10)
        .text(data.tilbudsbeskrivelse.trim(), M, doc.y, { width: CW });
      doc.y += doc.currentLineHeight() * (data.tilbudsbeskrivelse.trim().split("\n").length) + 20;
      doc.rect(M, doc.y, CW, 0.5).fill(BORDER);
      doc.y += 14;
    }

    // ── PRICE TABLE ──
    doc.fillColor(GRAY).font("Helvetica-Bold").fontSize(8)
      .text("PRISSAMMENDRAG", M, doc.y);
    doc.y += 10;

    const AMT_W = 110;
    const DESC_W = CW - AMT_W;
    const ROW_H = 22;
    let ry = doc.y;

    // header row
    doc.rect(M, ry, CW, ROW_H).fill(ORANGE);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(9)
      .text("Beskrivelse", M + 8, ry + 7, { width: DESC_W - 16, lineBreak: false });
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(9)
      .text("Beløp inkl. MVA", M + DESC_W, ry + 7, { width: AMT_W - 8, align: "right", lineBreak: false });
    ry += ROW_H;

    let idx = 0;
    function addRow(desc: string, amount: number) {
      const bg = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
      doc.rect(M, ry, CW, ROW_H).fill(bg);
      doc.rect(M, ry, CW, ROW_H).lineWidth(0.5).stroke(BORDER);
      doc.fillColor(DARK).font("Helvetica").fontSize(9)
        .text(desc, M + 8, ry + 7, { width: DESC_W - 16, lineBreak: false });
      doc.fillColor(DARK).font("Helvetica").fontSize(9)
        .text(fmtNOK(amount), M + DESC_W, ry + 7, { width: AMT_W - 8, align: "right", lineBreak: false });
      ry += ROW_H;
      idx++;
    }

    addRow("Søknadshjelp", data.permitPrice);
    for (const d of data.manualDisps) addRow(d.description, d.amount);
    for (const c of data.extraCosts) addRow(c.description, c.amount);

    const total =
      data.permitPrice +
      data.manualDisps.reduce((s, d) => s + d.amount, 0) +
      data.extraCosts.reduce((s, c) => s + c.amount, 0);

    // total row
    const TR_H = ROW_H + 6;
    doc.rect(M, ry, CW, TR_H).fill("#fff7ed");
    doc.rect(M, ry, CW, TR_H).lineWidth(1.5).stroke(ORANGE);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
      .text("Totalt (inkl. MVA)", M + 8, ry + 9, { width: DESC_W - 16, lineBreak: false });
    doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(13)
      .text(fmtNOK(total), M + DESC_W, ry + 7, { width: AMT_W - 8, align: "right", lineBreak: false });
    ry += TR_H;

    doc.y = ry + 16;
    doc.fillColor(GRAY).font("Helvetica").fontSize(8)
      .text("Prisen er et estimat og kan justeres etter videre befaring og dialog.", M, doc.y, { width: CW });

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
