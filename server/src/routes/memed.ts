import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { encryptField } from "../lib/crypto";
import {
  getMemedConfig,
  getPrescriberToken,
  missingPrescriberFields,
  MemedError,
  onlyDigits,
  toBrDate,
} from "../lib/memed";

/**
 * Rotas da integração Memed — todas novas, montadas em /api/memed.
 * Com a integração desligada (sem chaves), /config responde enabled:false e o resto 503.
 */
const router = Router();

function audit(req: AuthRequest, action: string, resourceId?: string, success = true, metadata?: Record<string, unknown>) {
  return prisma.auditLog
    .create({
      data: {
        userId: req.userId!,
        action,
        resource: "prescription",
        resourceId: resourceId ?? null,
        ipAddress: req.ip ?? "unknown",
        success,
        ...(metadata ? { metadata: metadata as object } : {}),
      },
    })
    .catch(() => {});
}

function disabled(res: Response) {
  return res.status(503).json({ error: "Prescrição Memed não configurada", code: "MEMED_DISABLED" });
}

// ─── GET /api/memed/config ────────────────────────────────────────────────────
router.get("/config", authenticate, (_req: AuthRequest, res: Response) => {
  const cfg = getMemedConfig();
  return res.json({ success: true, enabled: !!cfg, scriptUrl: cfg?.scriptUrl ?? null });
});

// ─── POST /api/memed/token ────────────────────────────────────────────────────
// Token do prescritor (recuperado a cada atendimento) + dados para setWorkplace.
router.post("/token", authenticate, async (req: AuthRequest, res: Response) => {
  const cfg = getMemedConfig();
  if (!cfg) return disabled(res);

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado", code: "USER_NOT_FOUND" });

    const missing = missingPrescriberFields(user);
    if (missing.length) {
      const motivo = missing.includes("sobrenome")
        ? "Seu nome cadastrado precisa ter nome e sobrenome para emitir receitas."
        : missing.includes("crm")
          ? "CRM cadastrado em formato inválido para emissão de receitas."
          : "Complete seus dados de prescritor no Perfil para emitir receitas.";
      return res.status(422).json({
        error: motivo,
        code: "PRESCRIBER_INCOMPLETE",
        missing,
      });
    }

    const token = await getPrescriberToken(cfg, user);

    const workplace =
      user.workplaceName && user.workplaceCity && user.workplaceUf
        ? {
            id: `${cfg.prefix}-clinica-${user.id}`,
            nome: user.workplaceName,
            endereco: user.workplaceAddress ?? "",
            telefone: user.workplacePhone ?? "",
            cidade: user.workplaceCity,
            uf: user.workplaceUf,
          }
        : null;

    await audit(req, "MEMED_TOKEN_ISSUED");
    return res.json({ success: true, token, scriptUrl: cfg.scriptUrl, prefix: cfg.prefix, workplace });
  } catch (err) {
    if (err instanceof MemedError) {
      console.error(`memed token: ${err.message} (HTTP ${err.status})`);
      await audit(req, "MEMED_TOKEN_ISSUED", undefined, false, { status: err.status });
      return res.status(502).json({
        error: err.detail ? `Memed: ${err.detail}` : err.message,
        code: "MEMED_PRESCRIBER_ERROR",
      });
    }
    console.error("memed token:", err);
    return res.status(502).json({ error: "Não foi possível conectar à Memed. Tente novamente.", code: "MEMED_UNAVAILABLE" });
  }
});

// ─── GET /api/memed/consultations/:id/patient ────────────────────────────────
// Dados do paciente no formato do comando setPaciente.
router.get("/consultations/:id/patient", authenticate, async (req: AuthRequest, res: Response) => {
  const cfg = getMemedConfig();
  if (!cfg) return disabled(res);
  const id = String(req.params["id"]);

  const c = await prisma.consultation.findFirst({ where: { id, doctorId: req.userId! }, include: { patient: true } });
  if (!c) return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });
  const p = c.patient;

  const missing: string[] = [];
  if (p.sex !== "Masculino" && p.sex !== "Feminino") missing.push("sex");

  return res.json({
    success: true,
    missing,
    patient: {
      idExterno: `${cfg.prefix}-pac-${p.id}`,
      nome: p.name,
      sexo: p.sex ?? undefined,
      ...(p.cpf ? { cpf: onlyDigits(p.cpf) } : {}),
      ...(p.dateOfBirth ? { data_nascimento: toBrDate(p.dateOfBirth) } : {}),
      ...(p.phone ? { telefone: onlyDigits(p.phone) } : {}),
      ...(p.email ? { email: p.email } : {}),
    },
    current: { id: p.id, sex: p.sex, cpf: p.cpf, dateOfBirth: p.dateOfBirth, phone: p.phone },
  });
});

// ─── GET /api/memed/consultations/:id/prescriptions ──────────────────────────
router.get("/consultations/:id/prescriptions", authenticate, async (req: AuthRequest, res: Response) => {
  const id = String(req.params["id"]);
  const c = await prisma.consultation.findFirst({ where: { id, doctorId: req.userId! }, select: { id: true } });
  if (!c) return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });

  const prescriptions = await prisma.prescription.findMany({
    where: { consultationId: id },
    orderBy: { printedAt: "desc" },
    select: { id: true, memedId: true, itemsCount: true, printedAt: true, deletedAt: true },
  });
  return res.json({ success: true, prescriptions });
});

// ─── POST /api/memed/consultations/:id/prescriptions ─────────────────────────
// Evento prescricaoImpressa → persiste a prescrição no prontuário.
const saveSchema = z.object({
  memedId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(100)),
  itemsCount: z.number().int().min(0).max(1000).optional(),
  payload: z.unknown().optional(),
});

router.post("/consultations/:id/prescriptions", authenticate, async (req: AuthRequest, res: Response) => {
  const parse = saveSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Dados inválidos", code: "VALIDATION_ERROR" });
  const id = String(req.params["id"]);

  const c = await prisma.consultation.findFirst({ where: { id, doctorId: req.userId! }, select: { id: true, patientId: true } });
  if (!c) return res.status(404).json({ error: "Consulta não encontrada", code: "NOT_FOUND" });

  const { memedId, itemsCount, payload } = parse.data;
  let payloadText: string | null = null;
  if (payload !== undefined) {
    const raw = JSON.stringify(payload);
    payloadText = raw.length <= 2_000_000 ? encryptField(raw) : null; // dado sensível: criptografado
  }

  try {
    const existing = await prisma.prescription.findUnique({ where: { memedId } });
    if (existing && existing.doctorId !== req.userId!) {
      return res.status(409).json({ error: "Prescrição pertence a outro usuário", code: "CONFLICT" });
    }
    const saved = existing
      ? await prisma.prescription.update({
          where: { memedId },
          data: { ...(payloadText ? { payload: payloadText } : {}), ...(itemsCount !== undefined ? { itemsCount } : {}), deletedAt: null },
        })
      : await prisma.prescription.create({
          data: {
            memedId,
            doctorId: req.userId!,
            consultationId: c.id,
            patientId: c.patientId,
            payload: payloadText,
            itemsCount: itemsCount ?? null,
          },
        });

    await audit(req, "PRESCRIPTION_SAVED", saved.id);
    return res.status(existing ? 200 : 201).json({
      success: true,
      prescription: { id: saved.id, memedId: saved.memedId, itemsCount: saved.itemsCount, printedAt: saved.printedAt, deletedAt: saved.deletedAt },
    });
  } catch (err) {
    console.error("save prescription:", err);
    return res.status(500).json({ error: "Erro ao salvar prescrição", code: "INTERNAL_ERROR" });
  }
});

// ─── DELETE /api/memed/prescriptions/:memedId ─────────────────────────────────
// Evento prescricaoExcluida → exclusão lógica (o registro fica no histórico do prontuário).
router.delete("/prescriptions/:memedId", authenticate, async (req: AuthRequest, res: Response) => {
  const memedId = String(req.params["memedId"]);
  const p = await prisma.prescription.findUnique({ where: { memedId } });
  if (!p || p.doctorId !== req.userId!) {
    return res.status(404).json({ error: "Prescrição não encontrada", code: "NOT_FOUND" });
  }
  if (!p.deletedAt) await prisma.prescription.update({ where: { memedId }, data: { deletedAt: new Date() } });
  await audit(req, "PRESCRIPTION_DELETED", p.id);
  return res.json({ success: true });
});

export default router;
