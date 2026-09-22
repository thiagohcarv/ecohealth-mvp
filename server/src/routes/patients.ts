import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

function getIp(req: AuthRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  return (typeof fwd === "string" ? fwd.split(",")[0]?.trim() : undefined) ?? req.socket.remoteAddress ?? "unknown";
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
});

router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error: parse.error.errors[0]?.message ?? "Dados inválidos",
      code: "VALIDATION_ERROR",
    });
  }

  const { name, dateOfBirth, cpf, phone } = parse.data;

  try {
    const patient = await prisma.patient.create({
      data: {
        name,
        doctorId: req.userId!,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        ...(cpf ? { cpf } : {}),
        ...(phone ? { phone } : {}),
      },
    });

    return res.status(201).json({ success: true, patient });
  } catch (err) {
    console.error("create patient:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

export default router;
