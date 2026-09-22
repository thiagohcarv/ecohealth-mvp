import crypto from "crypto";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

export interface ConsultationData {
  id: string;
  date: Date;
  chiefComplaint?: string | null;
  patient: {
    name: string;
    dateOfBirth?: Date | null;
    cpf?: string | null;
  };
  doctor: {
    name: string;
    crm: string;
    email: string;
  };
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    icd10Codes: string[];
    confidence?: number | null;
    model: string;
  };
}

const PRIMARY = "#2260FF";
const TEXT = "#1A1C1E";
const LIGHT_GRAY = "#F5F5F5";
const BORDER = "#E0E0E0";

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export async function generateSignedPdf(data: ConsultationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      info: {
        Title: `Consulta - ${data.patient.name}`,
        Author: data.doctor.name,
        Subject: "Nota SOAP Médica",
        Creator: "EcoHealth MVP",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      // Sign after first pass: hash the raw content
      const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
      // Re-build with footer containing the hash (second pass not supported in pdfkit —
      // we embed the hash in the generation itself via a pre-computed placeholder approach)
      resolve(pdfBuffer);
    });
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const signedAt = new Date();

    // Pre-compute content hash from deterministic string (not from PDF bytes, as circular)
    const contentFingerprint = [
      data.id,
      data.patient.name,
      data.doctor.crm,
      data.soapNote.subjective,
      data.soapNote.objective,
      data.soapNote.assessment,
      data.soapNote.plan,
      ...data.soapNote.icd10Codes,
      signedAt.toISOString(),
    ].join("|");
    const documentHash = crypto.createHash("sha256").update(contentFingerprint).digest("hex");

    // ─── HEADER ────────────────────────────────────────────────────────────────
    doc
      .rect(doc.page.margins.left, 40, pageWidth, 70)
      .fillColor(PRIMARY)
      .fill();

    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text("EcoHealth", doc.page.margins.left + 16, 55, { lineBreak: false });

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#CAD6FF")
      .text("Plataforma Médica Inteligente", doc.page.margins.left + 16, 78, { lineBreak: false });

    // Doctor info on the right side of header
    const doctorX = doc.page.margins.left + pageWidth - 220;
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text(data.doctor.name, doctorX, 55, { width: 210, align: "right", lineBreak: false });

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#CAD6FF")
      .text(`CRM: ${data.doctor.crm}`, doctorX, 68, { width: 210, align: "right", lineBreak: false });

    doc
      .fontSize(7)
      .fillColor("#CAD6FF")
      .text(data.doctor.email, doctorX, 80, { width: 210, align: "right", lineBreak: false });

    doc.y = 128;

    // ─── DOCUMENT TITLE ────────────────────────────────────────────────────────
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor(TEXT)
      .text("REGISTRO CLÍNICO — NOTA SOAP", { align: "center" });

    doc.moveDown(0.4);

    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + pageWidth, doc.y)
      .strokeColor(BORDER)
      .lineWidth(1)
      .stroke();

    doc.moveDown(0.8);

    // ─── PATIENT DATA ──────────────────────────────────────────────────────────
    const sectionY = doc.y;
    doc
      .rect(doc.page.margins.left, sectionY - 4, pageWidth, 22)
      .fillColor(LIGHT_GRAY)
      .fill();

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(PRIMARY)
      .text("DADOS DO PACIENTE", doc.page.margins.left + 8, sectionY + 2);

    doc.y = sectionY + 26;

    const colW = pageWidth / 3;
    const rowY = doc.y;

    function infoCell(label: string, value: string, x: number, y: number, width: number) {
      doc.fontSize(7).font("Helvetica").fillColor("#666666").text(label, x, y, { width, lineBreak: false });
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(TEXT)
        .text(value || "—", x, y + 10, { width, lineBreak: false });
    }

    infoCell("Paciente", data.patient.name, doc.page.margins.left, rowY, colW - 10);
    infoCell(
      "Data de Nascimento",
      data.patient.dateOfBirth ? formatDate(data.patient.dateOfBirth) : "—",
      doc.page.margins.left + colW,
      rowY,
      colW - 10
    );
    infoCell(
      "Data da Consulta",
      formatDate(data.date),
      doc.page.margins.left + colW * 2,
      rowY,
      colW
    );

    doc.y = rowY + 30;

    if (data.chiefComplaint) {
      infoCell("Queixa Principal", data.chiefComplaint, doc.page.margins.left, doc.y, pageWidth);
      doc.y += 28;
    }

    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + pageWidth, doc.y)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke();

    doc.moveDown(0.8);

    // ─── SOAP SECTIONS ─────────────────────────────────────────────────────────
    const soapSections: Array<{ key: keyof typeof data.soapNote; label: string; abbr: string; color: string }> = [
      { key: "subjective", label: "SUBJETIVO", abbr: "S", color: "#2260FF" },
      { key: "objective", label: "OBJETIVO", abbr: "O", color: "#7C3AED" },
      { key: "assessment", label: "AVALIAÇÃO", abbr: "A", color: "#D97706" },
      { key: "plan", label: "PLANO", abbr: "P", color: "#16A34A" },
    ];

    for (const section of soapSections) {
      const content = data.soapNote[section.key] as string;
      if (!content) continue;

      const labelY = doc.y;

      // Section badge
      doc
        .rect(doc.page.margins.left, labelY, 22, 22)
        .fillColor(section.color)
        .fill();

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#FFFFFF")
        .text(section.abbr, doc.page.margins.left + 6, labelY + 5, { lineBreak: false });

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(section.color)
        .text(section.label, doc.page.margins.left + 28, labelY + 7, { lineBreak: false });

      doc.y = labelY + 26;

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(TEXT)
        .text(content, doc.page.margins.left + 8, doc.y, {
          width: pageWidth - 8,
          align: "justify",
        });

      doc.moveDown(0.8);

      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }
    }

    // ─── CID-10 ────────────────────────────────────────────────────────────────
    if (data.soapNote.icd10Codes.length > 0) {
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageWidth, doc.y)
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .stroke();

      doc.moveDown(0.6);

      const cidY = doc.y;
      doc
        .rect(doc.page.margins.left, cidY - 4, pageWidth, 20)
        .fillColor(LIGHT_GRAY)
        .fill();

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY)
        .text("CLASSIFICAÇÃO CID-10", doc.page.margins.left + 8, cidY + 2);

      doc.y = cidY + 24;

      let cidX = doc.page.margins.left;
      const cidY2 = doc.y;

      for (const code of data.soapNote.icd10Codes) {
        const codeWidth = 50;
        doc
          .rect(cidX, cidY2, codeWidth, 20)
          .fillColor(PRIMARY)
          .fill();
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#FFFFFF")
          .text(code, cidX + 4, cidY2 + 5, { width: codeWidth - 8, align: "center", lineBreak: false });
        cidX += codeWidth + 8;
      }

      if (data.soapNote.confidence != null) {
        const confPct = Math.round(data.soapNote.confidence * 100);
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#666666")
          .text(
            `Confiança IA: ${confPct}% · Modelo: ${data.soapNote.model}`,
            doc.page.margins.left + pageWidth - 180,
            cidY2 + 6,
            { width: 180, align: "right", lineBreak: false }
          );
      }

      doc.y = cidY2 + 32;
    }

    // ─── QR CODE PLACEHOLDER ───────────────────────────────────────────────────
    doc.moveDown(1);

    if (doc.y > doc.page.height - 160) {
      doc.addPage();
    }

    const qrY = doc.y;
    const qrSize = 64;

    // QR box (simulated — text representation)
    doc
      .rect(doc.page.margins.left, qrY, qrSize, qrSize)
      .strokeColor(TEXT)
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(6)
      .font("Helvetica")
      .fillColor("#999999")
      .text("QR CODE", doc.page.margins.left + 14, qrY + 26, { width: qrSize - 4, align: "center", lineBreak: false });

    doc
      .fontSize(5)
      .fillColor("#AAAAAA")
      .text("(mock ICP-Brasil)", doc.page.margins.left + 6, qrY + 36, { width: qrSize - 4, align: "center", lineBreak: false });

    // Hash and signature info beside QR
    const infoX = doc.page.margins.left + qrSize + 16;
    const infoW = pageWidth - qrSize - 16;

    doc
      .fontSize(7)
      .font("Helvetica-Bold")
      .fillColor(TEXT)
      .text("HASH SHA-256 DO DOCUMENTO:", infoX, qrY + 2, { width: infoW });

    doc
      .fontSize(6.5)
      .font("Helvetica")
      .fillColor("#444444")
      .text(documentHash, infoX, qrY + 14, { width: infoW, lineBreak: true });

    doc
      .fontSize(7)
      .font("Helvetica-Bold")
      .fillColor(TEXT)
      .text("Assinado em:", infoX, qrY + 38, { width: infoW, lineBreak: false });

    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor(TEXT)
      .text(formatDateTime(signedAt), infoX + 55, qrY + 38, { width: infoW - 55, lineBreak: false });

    doc
      .fontSize(7)
      .font("Helvetica-Bold")
      .fillColor(TEXT)
      .text("ID Documento:", infoX, qrY + 50, { width: infoW, lineBreak: false });

    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor(TEXT)
      .text(data.id, infoX + 70, qrY + 50, { width: infoW - 70, lineBreak: false });

    // ─── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - doc.page.margins.bottom - 48;

    doc
      .moveTo(doc.page.margins.left, footerY)
      .lineTo(doc.page.margins.left + pageWidth, footerY)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke();

    doc
      .rect(doc.page.margins.left, footerY + 6, pageWidth, 36)
      .fillColor(LIGHT_GRAY)
      .fill();

    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(PRIMARY)
      .text("✓ Assinado digitalmente (mock ICP-Brasil)", doc.page.margins.left + 8, footerY + 10, {
        width: pageWidth - 16,
        align: "center",
      });

    doc
      .fontSize(6.5)
      .font("Helvetica")
      .fillColor("#666666")
      .text(
        `Este documento foi gerado eletronicamente pelo sistema EcoHealth em ${formatDateTime(signedAt)}. ` +
          "A assinatura digital é simulada (mock) para fins de demonstração — não possui validade jurídica ICP-Brasil real. " +
          `Hash SHA-256: ${documentHash.slice(0, 32)}...`,
        doc.page.margins.left + 8,
        footerY + 22,
        { width: pageWidth - 16, align: "center" }
      );

    doc.end();
  });
}

export async function savePdf(buffer: Buffer, consultationId: string): Promise<string> {
  const dir = "/tmp/ecohealth";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `consulta_${consultationId}.pdf`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
