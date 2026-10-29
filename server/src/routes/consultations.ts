import { Router, Response, NextFunction } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { ConsultationStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { checkPlan } from "../middleware/checkPlan";
import { lgpdRequired } from "../middleware/lgpdRequired";
import { aiMockAllowed, AiConfigError } from "../lib/aiMode";
import { transcribeAudio } from "../services/whisperService";
import { generateSoapNote } from "../services/soapGeneratorService";
import { generateSignedPdf, savePdf } from "../services/pdfSignerService";
import { encryptField, decryptField } from "../lib/crypto";
import { LOAD_TEST_MODE } from "../lib/loadTestMode";

// 10 IA calls / min per IP — protects OpenAI quota (raised under LOAD_TEST_MODE)
const iaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: LOAD_TEST_MODE ? 100_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de requisições de IA excedido. Tente em 1 minuto.", code: "AI_RATE_LIMIT" },
});

const router = Router();

// Multer em MEMÓRIA: o áudio nunca é gravado em disco. Limite = limite do Whisper (25 MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("audio/") || file.mimetype.startsWith("video/"));
  },
});

function receiveAudio(req: AuthRequest, res: Response, next: NextFunction): void {
  upload.single("audioFile")(req, res, (err: unknown) => {
    if (!err) return next();
    const code = (err as { code?: string }).code;
    if (code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Áudio muito grande (máximo 25 MB). Grave em partes menores.", code: "AUDIO_TOO_LARGE" });
      return;
    }
    res.status(400).json({ error: "Não foi possível receber o áudio.", code: "AUDIO_UPLOAD_ERROR" });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(["PENDING", "RECORDING", "PROCESSING", "COMPLETED", "FAILED", "SIGNED"]);

function toStatus(val: unknown): ConsultationStatus | undefined {
  if (typeof val === "string" && VALID_STATUSES.has(val)) return val as ConsultationStatus;
  return undefined;
}

function paramId(req: AuthRequest): string | null {
  const id = req.params["id"];
  return typeof id === "string" ? id : null;
}

function getIp(req: AuthRequest): string {
  return req.ip ?? "unknown";
}

async function logAudit(params: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  req: AuthRequest;
  success?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Never block the main request on audit failure
  await prisma.auditLog
    .create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        ipAddress: getIp(params.req),
        userAgent: params.req.headers["user-agent"] ?? "unknown",
        success: params.success ?? true,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    })
    .catch(() => {});
}

// ─── GET /api/consultations ───────────────────────────────────────────────────

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const status = toStatus(req.query["status"]);
  const limitRaw = req.query["limit"];
  const offsetRaw = req.query["offset"];
  const limit = Math.min(typeof limitRaw === "string" ? parseInt(limitRaw, 10) || 20 : 20, 50);
  const skip = typeof offsetRaw === "string" ? parseInt(offsetRaw, 10) || 0 : 0;

  try {
    const where = {
      doctorId: req.userId!,
      ...(status ? { status } : {}),
    };

    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        include: {
          patient: { select: { id: true, name: true, cpf: true } },
          soapNote: { select: { id: true, assessment: true, icd10Codes: true } },
          audioRecording: { select: { durationSec: true } },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip,
      }),
      prisma.consultation.count({ where }),
    ]);

    // Decrypt SOAP assessment shown in the list
    const decrypted = consultations.map((c) => ({
      ...c,
      soapNote: c.soapNote
        ? { ...c.soapNote, assessment: decryptField(c.soapNote.assessment) }
        : null,
    }));

    return res.json({ success: true, consultations: decrypted, total });
  } catch (err) {
    console.error("get consultations:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── GET /api/consultations/:id ───────────────────────────────────────────────

router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

  try {
    const consultation = await prisma.consultation.findFirst({
      where: { id, doctorId: req.userId! },
      include: { patient: true, soapNote: true, audioRecording: true },
    });

    if (!consultation) {
      return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
    }

    // Decrypt encrypted fields before sending to client
    const result = {
      ...consultation,
      soapNote: consultation.soapNote
        ? {
            ...consultation.soapNote,
            subjective: decryptField(consultation.soapNote.subjective),
            objective: decryptField(consultation.soapNote.objective),
            assessment: decryptField(consultation.soapNote.assessment),
            plan: decryptField(consultation.soapNote.plan),
          }
        : null,
      audioRecording: consultation.audioRecording
        ? {
            ...consultation.audioRecording,
            transcription: decryptField(consultation.audioRecording.transcription),
            // BigInt isn't JSON-serializable; well within Number's safe range for file sizes
            sizeBytes:
              consultation.audioRecording.sizeBytes !== null
                ? Number(consultation.audioRecording.sizeBytes)
                : null,
            // Legado: não há áudio armazenado (o áudio é descartado após a transcrição)
            s3Key: undefined,
            s3Bucket: undefined,
          }
        : null,
    };

    await logAudit({
      userId: req.userId!,
      action: "CONSULTATION_VIEWED",
      resource: "consultation",
      resourceId: id,
      req,
    });

    return res.json({ success: true, consultation: result });
  } catch (err) {
    console.error("get consultation:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/consultations ──────────────────────────────────────────────────

const createSchema = z.object({
  patientName: z.string().min(2, "Nome do paciente obrigatório"),
  patientId: z.string().optional(),
  chiefComplaint: z.string().optional(),
});

router.post("/", authenticate, lgpdRequired, async (req: AuthRequest, res: Response) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error: parse.error.errors[0]?.message ?? "Dados inválidos",
      code: "VALIDATION_ERROR",
    });
  }

  const { patientName, patientId, chiefComplaint } = parse.data;

  try {
    let patient;

    if (patientId) {
      patient = await prisma.patient.findFirst({
        where: { id: patientId, doctorId: req.userId! },
      });
      if (!patient) {
        return res.status(404).json({ error: "Paciente não encontrado", code: "PATIENT_NOT_FOUND" });
      }
    } else {
      patient = await prisma.patient.findFirst({
        where: { name: { equals: patientName, mode: "insensitive" }, doctorId: req.userId! },
      });
      if (!patient) {
        patient = await prisma.patient.create({
          data: { name: patientName, doctorId: req.userId! },
        });
      }
    }

    const consultation = await prisma.consultation.create({
      data: {
        doctorId: req.userId!,
        patientId: patient.id,
        chiefComplaint,
        status: "RECORDING",
      },
      include: { patient: { select: { id: true, name: true } } },
    });

    await logAudit({
      userId: req.userId!,
      action: "CONSULTATION_CREATED",
      resource: "consultation",
      resourceId: consultation.id,
      req,
      metadata: { patientId: patient.id },
    });

    return res.status(201).json({ success: true, consultation });
  } catch (err) {
    console.error("create consultation:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── PATCH /api/consultations/:id/status ─────────────────────────────────────

const statusSchema = z.object({
  // SIGNED só é definido pela rota de assinatura — nunca manualmente
  status: z.enum(["PENDING", "RECORDING", "PROCESSING", "COMPLETED", "FAILED"]),
});

router.patch("/:id/status", authenticate, async (req: AuthRequest, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

  const parse = statusSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Status inválido", code: "VALIDATION_ERROR" });
  }

  try {
    const exists = await prisma.consultation.findFirst({
      where: { id, doctorId: req.userId! },
    });
    if (!exists) {
      return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
    }

    const updated = await prisma.consultation.update({
      where: { id },
      data: { status: parse.data.status },
    });

    return res.json({ success: true, consultation: updated });
  } catch (err) {
    console.error("update status:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── PATCH /api/consultations/:id/soap ───────────────────────────────────────

const MAX_SOAP_FIELD = 50_000;

const soapEditSchema = z.object({
  subjective: z.string().max(MAX_SOAP_FIELD).trim().optional(),
  objective:  z.string().max(MAX_SOAP_FIELD).trim().optional(),
  assessment: z.string().max(MAX_SOAP_FIELD).trim().optional(),
  plan:       z.string().max(MAX_SOAP_FIELD).trim().optional(),
  icd10Codes: z.array(z.string().max(10).trim()).max(20).optional(),
});

router.patch("/:id/soap", authenticate, async (req: AuthRequest, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

  const parse = soapEditSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Dados inválidos", code: "VALIDATION_ERROR" });
  }

  try {
    const consultation = await prisma.consultation.findFirst({
      where: { id, doctorId: req.userId! },
      select: { id: true },
    });
    if (!consultation) {
      return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
    }

    const soapNote = await prisma.soapNote.findUnique({
      where: { consultationId: id },
      select: { id: true },
    });
    if (!soapNote) {
      return res.status(404).json({ error: "Nota SOAP não encontrada", code: "SOAP_NOT_FOUND" });
    }

    const { subjective, objective, assessment, plan, icd10Codes } = parse.data;

    const updated = await prisma.soapNote.update({
      where: { consultationId: id },
      data: {
        ...(subjective !== undefined ? { subjective: encryptField(subjective) ?? subjective } : {}),
        ...(objective !== undefined  ? { objective:  encryptField(objective)  ?? objective  } : {}),
        ...(assessment !== undefined ? { assessment: encryptField(assessment) ?? assessment } : {}),
        ...(plan !== undefined       ? { plan:       encryptField(plan)       ?? plan       } : {}),
        ...(icd10Codes !== undefined ? { icd10Codes } : {}),
        editedAt: new Date(),
      },
    });

    await logAudit({
      userId: req.userId!,
      action: "SOAP_EDITED",
      resource: "consultation",
      resourceId: id,
      req,
    });

    // Return decrypted so the client sees the plain text immediately
    return res.json({
      success: true,
      soapNote: {
        ...updated,
        subjective: decryptField(updated.subjective),
        objective: decryptField(updated.objective),
        assessment: decryptField(updated.assessment),
        plan: decryptField(updated.plan),
      },
    });
  } catch (err) {
    console.error("update soap:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── PATCH /api/consultations/:id/transcribe ─────────────────────────────────
// O ÁUDIO NUNCA É ARMAZENADO: chega em memória, vai ao Whisper e é descartado
// (o buffer é zerado ao final). Só ficam no banco a transcrição (criptografada)
// e metadados (duração, tamanho e formato).

router.patch(
  "/:id/transcribe",
  authenticate,
  iaLimiter,
  receiveAudio,
  async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "Arquivo de áudio obrigatório", code: "AUDIO_MISSING" });

    try {
      const consultation = await prisma.consultation.findFirst({
        where: { id, doctorId: req.userId! },
      });
      if (!consultation) {
        return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
      }

      await prisma.consultation.update({ where: { id }, data: { status: "PROCESSING" } });

      const result = await transcribeAudio(file.buffer, id, file.mimetype);

      // Áudio sem fala: não é "sucesso" — o médico precisa saber para gravar de novo
      if (!result.text || result.text.trim().length < 3) {
        await prisma.consultation.update({ where: { id }, data: { status: "PENDING" } }).catch(() => {});
        return res.status(422).json({
          error: "Não foi possível identificar fala no áudio. Verifique o microfone e grave novamente.",
          code: "EMPTY_TRANSCRIPTION",
        });
      }

      const encryptedTranscription = encryptField(result.text);
      const meta = {
        s3Key: null,
        s3Bucket: null, // legado: nunca há arquivo de áudio guardado
        sizeBytes: BigInt(file.size),
        durationSec: Math.round(result.duration),
        mimeType: file.mimetype,
        transcription: encryptedTranscription,
        transcribedAt: new Date(),
        transcriptionStatus: "COMPLETED" as const,
      };

      await prisma.audioRecording.upsert({
        where: { consultationId: id },
        create: { consultationId: id, ...meta },
        update: meta,
      });

      await prisma.consultation.update({ where: { id }, data: { status: "COMPLETED" } });

      await logAudit({
        userId: req.userId!,
        action: "TRANSCRIPTION_CREATED",
        resource: "consultation",
        resourceId: id,
        req,
        metadata: { durationSec: Math.round(result.duration), simulated: result.simulated === true },
      });

      return res.json({
        success: true,
        transcription: result.text,
        duration: result.duration,
        simulated: result.simulated === true,
      });
    } catch (err) {
      console.error("transcribe error:", err);

      const errMsg = err instanceof Error ? err.message : "Erro na transcrição";
      const notConfigured = err instanceof AiConfigError;
      const is429 = errMsg.includes("429");

      // Falta de chave/cota é recuperável: a consulta volta a PENDING (não FAILED)
      await prisma.consultation
        .update({ where: { id }, data: { status: notConfigured || is429 ? "PENDING" : "FAILED" } })
        .catch(() => {});

      if (notConfigured) {
        return res.status(503).json({ error: errMsg, code: "AI_NOT_CONFIGURED" });
      }
      if (is429) {
        return res.status(402).json({
          error: "Cota OpenAI esgotada. Adicione créditos em platform.openai.com/account/billing.",
          code: "QUOTA_EXCEEDED",
        });
      }
      return res.status(500).json({ error: errMsg, code: "TRANSCRIPTION_ERROR" });
    } finally {
      file.buffer.fill(0); // apaga o áudio da memória
    }
  }
);

// ─── PATCH /api/consultations/:id/transcription ──────────────────────────────
// O médico corrige a transcrição (ex.: nome de medicamento) ANTES de gerar o SOAP.
// A nota é gerada a partir do texto corrigido salvo aqui.

const transcriptionEditSchema = z.object({
  transcription: z.string().trim().min(3).max(100_000),
});

router.patch("/:id/transcription", authenticate, async (req: AuthRequest, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

  const parse = transcriptionEditSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Transcrição inválida (mínimo 3 caracteres).", code: "VALIDATION_ERROR" });
  }

  try {
    const consultation = await prisma.consultation.findFirst({
      where: { id, doctorId: req.userId! },
      select: { id: true },
    });
    if (!consultation) {
      return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
    }

    const recording = await prisma.audioRecording.findUnique({
      where: { consultationId: id },
      select: { id: true },
    });
    if (!recording) {
      return res.status(404).json({ error: "Transcrição não encontrada", code: "RECORDING_NOT_FOUND" });
    }

    await prisma.audioRecording.update({
      where: { consultationId: id },
      data: { transcription: encryptField(parse.data.transcription) },
    });

    await logAudit({
      userId: req.userId!,
      action: "TRANSCRIPTION_EDITED",
      resource: "consultation",
      resourceId: id,
      req,
    });

    return res.json({ success: true, transcription: parse.data.transcription });
  } catch (err) {
    console.error("update transcription:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/consultations/:id/generate-soap ───────────────────────────────

router.post("/:id/generate-soap", authenticate, iaLimiter, async (req: AuthRequest, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

  try {
    const consultation = await prisma.consultation.findFirst({
      where: { id, doctorId: req.userId! },
      include: {
        patient: { select: { name: true } },
        audioRecording: { select: { transcription: true } },
      },
    });

    if (!consultation) {
      return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
    }

    const rawTranscription = consultation.audioRecording?.transcription;
    if (!rawTranscription) {
      return res.status(400).json({ error: "Transcrição não disponível", code: "NO_TRANSCRIPTION" });
    }

    // Decrypt the stored transcription before passing to the AI service
    const transcription = decryptField(rawTranscription) ?? rawTranscription;

    const preferredModel =
      typeof req.headers["x-ai-model"] === "string" ? req.headers["x-ai-model"] : undefined;

    const result = await generateSoapNote(
      transcription,
      { name: consultation.patient.name, chiefComplaint: consultation.chiefComplaint ?? undefined },
      preferredModel
    );

    const soapNote = await prisma.soapNote.upsert({
      where: { consultationId: id },
      create: {
        consultationId: id,
        subjective: encryptField(result.subjective) ?? result.subjective,
        objective:  encryptField(result.objective)  ?? result.objective,
        assessment: encryptField(result.assessment) ?? result.assessment,
        plan:       encryptField(result.plan)       ?? result.plan,
        icd10Codes: result.icd10Codes,
        rawJson: result.rawJson as object,
        model: result.model,
        confidence: result.confidence,
        soapStatus: "COMPLETED",
      },
      update: {
        subjective: encryptField(result.subjective) ?? result.subjective,
        objective:  encryptField(result.objective)  ?? result.objective,
        assessment: encryptField(result.assessment) ?? result.assessment,
        plan:       encryptField(result.plan)       ?? result.plan,
        icd10Codes: result.icd10Codes,
        rawJson: result.rawJson as object,
        model: result.model,
        confidence: result.confidence,
        soapStatus: "COMPLETED",
        editedAt: null,
      },
    });

    await prisma.consultation.update({ where: { id }, data: { status: "COMPLETED" } });

    await logAudit({
      userId: req.userId!,
      action: "SOAP_GENERATED",
      resource: "consultation",
      resourceId: id,
      req,
      metadata: { model: result.model, confidence: result.confidence },
    });

    // Return decrypted SOAP to client
    return res.json({
      success: true,
      soapNote: {
        ...soapNote,
        subjective: result.subjective,
        objective:  result.objective,
        assessment: result.assessment,
        plan:       result.plan,
      },
    });
  } catch (err) {
    console.error("generate-soap error:", err);
    if (err instanceof AiConfigError) {
      return res.status(503).json({ error: err.message, code: "AI_NOT_CONFIGURED" });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      return res.status(402).json({
        error: "Cota OpenAI esgotada. Adicione créditos em platform.openai.com/account/billing.",
        code: "QUOTA_EXCEEDED",
      });
    }
    return res.status(500).json({ error: "Erro ao gerar nota SOAP", code: "SOAP_GENERATION_ERROR" });
  }
});

// ─── POST /api/consultations/:id/sign ────────────────────────────────────────

router.post("/:id/sign", authenticate, checkPlan, async (req: AuthRequest, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

  try {
    const consultation = await prisma.consultation.findFirst({
      where: { id, doctorId: req.userId! },
      include: {
        patient: { select: { name: true, dateOfBirth: true, cpf: true } },
        doctor: { select: { name: true, crm: true, email: true } },
        soapNote: {
          select: {
            subjective: true,
            objective: true,
            assessment: true,
            plan: true,
            icd10Codes: true,
            confidence: true,
            model: true,
          },
        },
      },
    });

    if (!consultation) {
      return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
    }

    if (!consultation.soapNote) {
      return res.status(400).json({ error: "Nota SOAP não gerada ainda", code: "NO_SOAP_NOTE" });
    }

    // Nota gerada em modo simulado (sem IA real) é dado fictício: não pode ser assinada
    if (consultation.soapNote.model === "mock" && !aiMockAllowed()) {
      return res.status(409).json({
        error: "Esta nota foi gerada em modo simulado (sem IA real) e não pode ser assinada. Gere a nota novamente.",
        code: "SIMULATED_NOTE",
      });
    }

    // Decrypt SOAP fields before building the PDF — the PDF must contain readable text
    const decryptedSoap = {
      ...consultation.soapNote,
      subjective: decryptField(consultation.soapNote.subjective) ?? consultation.soapNote.subjective ?? "",
      objective:  decryptField(consultation.soapNote.objective)  ?? consultation.soapNote.objective  ?? "",
      assessment: decryptField(consultation.soapNote.assessment) ?? consultation.soapNote.assessment ?? "",
      plan:       decryptField(consultation.soapNote.plan)       ?? consultation.soapNote.plan       ?? "",
    };

    const pdfBuffer = await generateSignedPdf({
      id: consultation.id,
      date: consultation.date,
      chiefComplaint: consultation.chiefComplaint,
      patient: consultation.patient,
      doctor: consultation.doctor,
      soapNote: decryptedSoap,
    });

    const pdfPath = await savePdf(pdfBuffer, id);

    await prisma.consultation.update({
      where: { id },
      data: { status: "SIGNED", signedAt: new Date(), pdfPath },
    });

    await logAudit({
      userId: req.userId!,
      action: "PDF_SIGNED",
      resource: "consultation",
      resourceId: id,
      req,
    });

    const patientName = consultation.patient.name.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStr = consultation.date.toISOString().slice(0, 10);
    const filename = `EcoHealth_${patientName}_${dateStr}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("sign consultation error:", err);
    return res.status(500).json({ error: "Erro ao gerar PDF assinado", code: "PDF_GENERATION_ERROR" });
  }
});

export default router;
