import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken, getTokenExpiry } from "../lib/jwt";
import { authenticate, AuthRequest } from "../middleware/auth";
import { revokeToken } from "../lib/tokenBlacklist";
import { encryptField } from "../lib/crypto";

const router = Router();

// OTP em memória — substituir por Redis em produção
const otpStore = new Map<string, { code: string; expiresAt: number }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeCrm(uf: string, crm: string): string {
  const clean = crm.replace(/[^0-9A-Za-z-]/g, "").toUpperCase();
  if (clean.includes("-")) return clean; // já formatado
  return `${uf.toUpperCase()}-${clean}`;
}

function generateOtp(): string {
  // Mock: fixo para alpha. Em produção: Math.floor(100000 + Math.random() * 900000).toString()
  return "123456";
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  nome: z.string().min(2, "Nome obrigatório"),
  crm: z.string().min(3, "CRM inválido"),
  uf: z.string().length(2, "UF deve ter 2 letras").toUpperCase(),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
});

router.post("/register", async (req: Request, res: Response) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error: parse.error.errors[0]?.message ?? "Dados inválidos",
      code: "VALIDATION_ERROR",
      details: parse.error.flatten(),
    });
  }

  const { email, senha, nome, crm, uf, cpf, telefone } = parse.data;
  const crmFormatado = normalizeCrm(uf, crm);

  try {
    // Verifica duplicatas
    const [emailExiste, crmExiste, cpfExiste] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { crm: crmFormatado } }),
      cpf ? prisma.user.findFirst({ where: { cpf } }) : Promise.resolve(null),
    ]);

    if (emailExiste) {
      return res.status(409).json({ error: "Email já cadastrado", code: "EMAIL_EXISTS" });
    }
    if (crmExiste) {
      return res.status(409).json({ error: "CRM já cadastrado", code: "CRM_EXISTS" });
    }
    if (cpfExiste) {
      return res.status(409).json({ error: "CPF já cadastrado", code: "CPF_EXISTS" });
    }

    const passwordHash = await bcrypt.hash(senha, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: nome,
        crm: crmFormatado,
        password: passwordHash,
        ...(cpf ? { cpf } : {}),
        ...(telefone ? { phone: telefone } : {}),
      },
    });

    // Gera e armazena OTP
    const otp = generateOtp();
    otpStore.set(email, { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    // TODO: enviar email real com OTP (Resend, SendGrid, etc.)
    console.log(`[DEV] OTP para ${email}: ${otp}`);

    return res.status(201).json({
      success: true,
      userId: user.id,
      message: "Código de verificação enviado para o email.",
    });
  } catch (err) {
    console.error("register:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

router.post("/login", async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Dados inválidos", code: "VALIDATION_ERROR" });
  }

  const { email, senha } = parse.data;

  const remoteIp =
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : undefined) ?? req.socket.remoteAddress ?? "unknown";

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn(`[AUTH] Login falhou — email não encontrado | IP: ${remoteIp}`);
      await prisma.auditLog.create({
        data: { userId: "unknown", action: "LOGIN_FAILED", resource: "auth", ipAddress: remoteIp, success: false, metadata: { reason: "email_not_found" } },
      }).catch(() => {});
      return res.status(401).json({ error: "Email ou senha inválidos", code: "INVALID_CREDENTIALS" });
    }

    const match = await bcrypt.compare(senha, user.password);
    if (!match) {
      console.warn(`[AUTH] Login falhou — senha incorreta | IP: ${remoteIp}`);
      await prisma.auditLog.create({
        data: { userId: user.id, action: "LOGIN_FAILED", resource: "auth", ipAddress: remoteIp, success: false, metadata: { reason: "wrong_password" } },
      }).catch(() => {});
      return res.status(401).json({ error: "Email ou senha inválidos", code: "INVALID_CREDENTIALS" });
    }

    const token = signToken(user.id);

    await prisma.auditLog.create({
      data: { userId: user.id, action: "LOGIN_SUCCESS", resource: "auth", ipAddress: remoteIp, success: true },
    }).catch(() => {});

    return res.json({
      success: true,
      token,
      userId: user.id,
      nome: user.name,
      crm: user.crm,
    });
  } catch (err) {
    console.error("login:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

router.post("/verify-otp", async (req: Request, res: Response) => {
  const parse = verifyOtpSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Dados inválidos", code: "VALIDATION_ERROR" });
  }

  const { email, otp } = parse.data;

  // Verifica OTP (com fallback mock para alpha)
  const stored = otpStore.get(email);
  const isValid =
    stored !== undefined
      ? stored.code === otp && stored.expiresAt > Date.now()
      : otp === "123456"; // fallback mock alpha

  if (!isValid) {
    return res.status(400).json({ error: "Código inválido ou expirado", code: "INVALID_OTP" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado", code: "USER_NOT_FOUND" });
    }

    // Marca conta como verificada e apaga OTP
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
    otpStore.delete(email);

    const token = signToken(user.id);

    return res.json({
      success: true,
      token,
      userId: user.id,
      nome: user.name,
    });
  } catch (err) {
    console.error("verify-otp:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/auth/refresh-otp ──────────────────────────────────────────────

const refreshOtpSchema = z.object({ email: z.string().email("Email inválido") });

router.post("/refresh-otp", async (req: Request, res: Response) => {
  const parse = refreshOtpSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: "Email inválido", code: "VALIDATION_ERROR" });
  }

  const { email } = parse.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado", code: "USER_NOT_FOUND" });
  }

  const otp = generateOtp();
  otpStore.set(email, { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  console.log(`[DEV] Novo OTP para ${email}: ${otp}`);

  return res.json({ success: true, message: "Novo código enviado." });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

router.post("/logout", authenticate, (req: AuthRequest, res: Response) => {
  const token = req.token!;
  revokeToken(token, getTokenExpiry(token));
  return res.json({ success: true });
});

// ─── POST /api/auth/lgpd-consent ─────────────────────────────────────────────

router.post("/lgpd-consent", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.lgpdConsent.findFirst({
      where: { userId: req.userId! },
    });
    if (existing) {
      return res.json({ success: true, consent: existing, alreadyConsented: true });
    }

    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress =
      (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) ??
      req.socket.remoteAddress ??
      "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";

    const consent = await prisma.lgpdConsent.create({
      data: {
        userId: req.userId!,
        ipAddress: encryptField(ipAddress) ?? ipAddress,
        userAgent: encryptField(userAgent) ?? userAgent,
        version: "1.0",
      },
    });

    await prisma.auditLog.create({
      data: { userId: req.userId!, action: "LGPD_CONSENT", resource: "auth", ipAddress, success: true },
    }).catch(() => {});

    // Return consent without the raw encrypted fields — client only needs acceptedAt
    return res.status(201).json({ success: true, consent: { id: consent.id, acceptedAt: consent.acceptedAt, version: consent.version } });
  } catch (err) {
    console.error("lgpd-consent:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── GET /api/auth/lgpd-consent ──────────────────────────────────────────────

router.get("/lgpd-consent", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const consent = await prisma.lgpdConsent.findFirst({
      where: { userId: req.userId! },
      orderBy: { acceptedAt: "desc" },
      select: { id: true, acceptedAt: true, version: true },
    });

    return res.json({ success: true, hasConsent: !!consent, consent: consent ?? null });
  } catch (err) {
    console.error("get lgpd-consent:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, crm: true, isVerified: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado", code: "USER_NOT_FOUND" });
    }

    return res.json({ success: true, user });
  } catch (err) {
    console.error("me:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

export default router;
