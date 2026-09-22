import fs from "fs";
import path from "path";
import os from "os";
import { Router, Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { ConsultationStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { checkPlan } from "../middleware/checkPlan";
import { lgpdRequired } from "../middleware/lgpdRequired";
import { transcribeAudio } from "../services/whisperService";
import { generateSoapNote } from "../services/soapGeneratorService";
import { generateSignedPdf, savePdf } from "../services/pdfSignerService";
import { uploadAudio, getSignedUrl, isS3Configured } from "../services/s3Service";
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

// 3 audio accesses / min per IP — audio data is highly sensitive (raised under LOAD_TEST_MODE)
const audioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: LOAD_TEST_MODE ? 100_000 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de acesso a áudio excedido. Tente em 1 minuto.", code: "AUDIO_RATE_LIMIT" },
});

const router = Router();

// Multer: saves audio to /tmp with a unique name
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(
      null,
      ["audio/webm", "audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/mp4", "video/webm"].includes(
        file.mimetype
      ) ||
        file.mimetype.startsWith("audio/") ||
        file.mimetype.startsWith("video/")
    );
  },
});

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

// Fallback local — usado quando o S3 não está configurado (dev) ou o upload falha
const AUDIO_DIR = "/tmp/ecohealth/audio";

function saveLocalAudio(buffer: Buffer, consultationId: string, ext: string): string {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const filePath = path.join(AUDIO_DIR, `${consultationId}${ext}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function getIp(req: AuthRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  return (
    (typeof fwd === "string" ? fwd.split(",")[0]?.trim() : undefined) ??
    req.socket.remoteAddress ??
    "unknown"
  );
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
            // Internal storage location — never expose to the client (use GET /:id/audio instead)
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
  status: z.enum(["PENDING", "RECORDING", "PROCESSING", "COMPLETED", "FAILED", "SIGNED"]),
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

router.patch(
  "/:id/transcribe",
  authenticate,
  iaLimiter,
  upload.single("audioFile"),
  async (req: AuthRequest, res: Response) => {
    const id = paramId(req);
    if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "Arquivo de áudio obrigatório", code: "AUDIO_MISSING" });

    const tmpPath = file.path;

    try {
      const consultation = await prisma.consultation.findFirst({
        where: { id, doctorId: req.userId! },
      });
      if (!consultation) {
        fs.unlink(tmpPath, () => {});
        return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
      }

      await prisma.consultation.update({ where: { id }, data: { status: "PROCESSING" } });

      const result = await transcribeAudio(tmpPath, id);

      const ext = path.extname(file.originalname) || ".webm";
      const audioBuffer = fs.readFileSync(tmpPath);

      // Persist the audio itself — S3 (AES256 server-side encryption) when configured,
      // otherwise a local fallback so dev environments work without AWS credentials.
      let s3Key: string;
      let s3Bucket: string;

      if (isS3Configured()) {
        try {
          s3Key = await uploadAudio(audioBuffer, id, req.userId!, file.mimetype);
          s3Bucket = process.env["AWS_S3_BUCKET"]!;
        } catch (uploadErr) {
          console.error("[S3] upload falhou, usando fallback local:", uploadErr);
          s3Key = saveLocalAudio(audioBuffer, id, ext);
          s3Bucket = "local";
        }
      } else {
        s3Key = saveLocalAudio(audioBuffer, id, ext);
        s3Bucket = "local";
      }

      await logAudit({
        userId: req.userId!,
        action: "AUDIO_UPLOADED",
        resource: "consultation",
        resourceId: id,
        req,
        metadata: { storage: s3Bucket === "local" ? "local" : "s3", sizeBytes: audioBuffer.length },
      });

      // Encrypt transcription before persisting
      const encryptedTranscription = encryptField(result.text);

      await prisma.audioRecording.upsert({
        where: { consultationId: id },
        create: {
          consultationId: id,
          s3Key,
          s3Bucket,
          sizeBytes: BigInt(audioBuffer.length),
          durationSec: Math.round(result.duration),
          mimeType: file.mimetype,
          transcription: encryptedTranscription,
          transcribedAt: new Date(),
          transcriptionStatus: "COMPLETED",
        },
        update: {
          s3Key,
          s3Bucket,
          sizeBytes: BigInt(audioBuffer.length),
          transcription: encryptedTranscription,
          transcribedAt: new Date(),
          durationSec: Math.round(result.duration),
          mimeType: file.mimetype,
          transcriptionStatus: "COMPLETED",
        },
      });

      await prisma.consultation.update({ where: { id }, data: { status: "COMPLETED" } });

      // Return the plaintext to the client (already decrypted from result.text)
      return res.json({ success: true, transcription: result.text, duration: result.duration });
    } catch (err) {
      console.error("transcribe error:", err);

      await prisma.audioRecording
        .upsert({
          where: { consultationId: id },
          create: { consultationId: id, transcriptionStatus: "ERROR" },
          update: { transcriptionStatus: "ERROR" },
        })
        .catch(() => {});
      await prisma.consultation.update({ where: { id }, data: { status: "FAILED" } }).catch(() => {});

      const errMsg = err instanceof Error ? err.message : "Erro na transcrição";
      const is429 = errMsg.includes("429");
      const statusCode = is429 ? 402 : 500;
      const userMsg = is429
        ? "Cota OpenAI esgotada. Adicione créditos em platform.openai.com/account/billing."
        : errMsg;

      return res.status(statusCode).json({ error: userMsg, code: is429 ? "QUOTA_EXCEEDED" : "TRANSCRIPTION_ERROR" });
    } finally {
      fs.unlink(tmpPath, () => {});
    }
  }
);

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

// ─── GET /api/consultations/:id/audio ────────────────────────────────────────
// Ownership-verified, rate-limited, audited access to audio/transcription data.
// audioUrl is a 5-minute presigned S3 URL when stored in S3, or a path to the
// local-fallback streaming route (GET /:id/audio/file) when S3 isn't configured.

router.get("/:id/audio", authenticate, audioLimiter, async (req: AuthRequest, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

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
      select: {
        durationSec: true,
        mimeType: true,
        transcription: true,
        transcriptionStatus: true,
        transcribedAt: true,
        s3Key: true,
      },
    });

    if (!recording) {
      return res.status(404).json({ error: "Gravação não encontrada", code: "RECORDING_NOT_FOUND" });
    }

    let audioUrl: string | null = null;
    if (recording.s3Key?.startsWith("s3://")) {
      try {
        audioUrl = await getSignedUrl(recording.s3Key);
      } catch (err) {
        console.error("gerar signed url:", err);
      }
    } else if (recording.s3Key && fs.existsSync(recording.s3Key)) {
      audioUrl = `/api/consultations/${id}/audio/file`;
    }

    await logAudit({
      userId: req.userId!,
      action: "AUDIO_ACCESSED",
      resource: "consultation",
      resourceId: id,
      req,
    });

    return res.json({
      success: true,
      recording: {
        durationSec: recording.durationSec,
        mimeType: recording.mimeType,
        transcriptionStatus: recording.transcriptionStatus,
        transcribedAt: recording.transcribedAt,
        transcription: decryptField(recording.transcription),
        audioUrl,
      },
    });
  } catch (err) {
    console.error("audio access error:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── GET /api/consultations/:id/audio/file ───────────────────────────────────
// Streams the local-fallback audio file. Only reachable when the recording was
// NOT persisted to S3 (s3Key holds a filesystem path rather than an s3:// URI).

router.get("/:id/audio/file", authenticate, audioLimiter, async (req: AuthRequest, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "ID inválido", code: "INVALID_ID" });

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
      select: { s3Key: true, mimeType: true },
    });

    if (!recording?.s3Key || recording.s3Key.startsWith("s3://") || !fs.existsSync(recording.s3Key)) {
      return res.status(404).json({ error: "Arquivo de áudio não encontrado", code: "FILE_NOT_FOUND" });
    }

    await logAudit({
      userId: req.userId!,
      action: "AUDIO_DOWNLOADED",
      resource: "consultation",
      resourceId: id,
      req,
    });

    res.setHeader("Content-Type", recording.mimeType);
    fs.createReadStream(recording.s3Key).pipe(res);
    return;
  } catch (err) {
    console.error("audio file stream error:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

export default router;
