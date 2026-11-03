import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

function getIp(req: AuthRequest): string {
  return req.ip ?? "unknown";
}

const router = Router();

// ─── GET /api/patients ────────────────────────────────────────────────────────

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  const limitRaw = req.query["limit"];
  const limit = Math.min(
    typeof limitRaw === "string" ? parseInt(limitRaw, 10) || 30 : 30,
    50
  );

  try {
    const patients = await prisma.patient.findMany({
      where: {
        doctorId: req.userId!,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        consultations: {
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId!, action: "PATIENT_LIST_VIEWED", resource: "patient", ipAddress: getIp(req), success: true },
    }).catch(() => {});

    return res.json({ success: true, patients });
  } catch (err) {
    console.error("get patients:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/patients ───────────────────────────────────────────────────────

const createSchema = z.object({
  name:        z.string().min(2, "Nome obrigatório").max(200).trim(),
  dateOfBirth: z.string().max(10).trim().optional(),
  cpf:         z.string().max(14).trim().optional(),
  phone:       z.string().max(20).trim().optional(),
  sex:         z.enum(["Masculino", "Feminino"]).optional(),
});

router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error: parse.error.errors[0]?.message ?? "Dados inválidos",
      code: "VALIDATION_ERROR",
    });
  }

  const { name, dateOfBirth, cpf, phone, sex } = parse.data;

  try {
    // CPF é único na tabela: devolve mensagem clara em vez de erro interno
    if (cpf && (await prisma.patient.findFirst({ where: { cpf }, select: { id: true } }))) {
      return res.status(409).json({ error: "CPF já cadastrado para outro paciente", code: "CPF_EXISTS" });
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        doctorId: req.userId!,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        ...(cpf ? { cpf } : {}),
        ...(phone ? { phone } : {}),
        ...(sex ? { sex } : {}),
      },
    });

    return res.status(201).json({ success: true, patient });
  } catch (err) {
    console.error("create patient:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── PATCH /api/patients/:id ──────────────────────────────────────────────────
// Completa dados cadastrais do paciente. Campos ausentes não mudam.

const updateSchema = z.object({
  sex:         z.enum(["Masculino", "Feminino"]).optional(),
  cpf:         z.string().max(14).trim().optional(),
  phone:       z.string().max(20).trim().optional(),
  dateOfBirth: z.string().max(10).trim().optional(),
});

router.patch("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors[0]?.message ?? "Dados inválidos", code: "VALIDATION_ERROR" });
  }
  const id = String(req.params["id"]);
  const { sex, cpf, phone, dateOfBirth } = parse.data;

  try {
    const owned = await prisma.patient.findFirst({ where: { id, doctorId: req.userId! }, select: { id: true } });
    if (!owned) return res.status(404).json({ error: "Paciente não encontrado", code: "NOT_FOUND" });

    if (cpf) {
      const dono = await prisma.patient.findFirst({ where: { cpf, NOT: { id } }, select: { id: true } });
      if (dono) return res.status(409).json({ error: "CPF já cadastrado para outro paciente", code: "CPF_EXISTS" });
    }
    let birth: Date | undefined;
    if (dateOfBirth) {
      birth = new Date(dateOfBirth);
      if (isNaN(birth.getTime())) return res.status(400).json({ error: "Data de nascimento inválida", code: "VALIDATION_ERROR" });
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        ...(sex ? { sex } : {}),
        ...(cpf ? { cpf } : {}),
        ...(phone ? { phone } : {}),
        ...(birth ? { dateOfBirth: birth } : {}),
      },
      select: { id: true, name: true, sex: true, cpf: true, phone: true, dateOfBirth: true },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId!, action: "PATIENT_UPDATED", resource: "patient", resourceId: id, ipAddress: getIp(req), success: true },
    }).catch(() => {});

    return res.json({ success: true, patient });
  } catch (err) {
    console.error("update patient:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

export default router;
