import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { CURRENT_CONSENT_VERSION } from "../lib/consent";
import { prisma } from "../lib/prisma";
import { signToken, getTokenExpiry } from "../lib/jwt";
import { authenticate, AuthRequest } from "../middleware/auth";
import { revokeToken } from "../lib/tokenBlacklist";
import { encryptField } from "../lib/crypto";
import { isValidCpf, onlyDigits, parseBirthDate } from "../lib/validators";
import { emailEnabled, sendOtpEmail } from "../lib/email";
import crypto from "crypto";

const router = Router();

// OTP em memória — substituir por Redis em produção
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number; sentAt: number }>();
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_MS = 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeCrm(uf: string, crm: string): string {
  const clean = crm.replace(/[^0-9A-Za-z-]/g, "").toUpperCase();
  if (clean.includes("-")) return clean; // já formatado
  return `${uf.toUpperCase()}-${clean}`;
}

function sanitizeNome(nome: string): string {
  return nome.trim().replace(/^dr\.?\(?a?\)?\.?\s+/i, "").trim();
}

/**
 * Cadastro por convite (alpha). SIGNUP_ALLOWLIST = e-mails e/ou domínios separados por vírgula
 * (ex.: "medico@gmail.com,@clinica.com.br"). Em PRODUÇÃO, sem a variável, o cadastro fica FECHADO.
 * Fora de produção (desenvolvimento) o cadastro é livre.
 */
function signupAllowed(email: string): boolean {
  const raw = process.env["SIGNUP_ALLOWLIST"];
  if (!raw) return process.env["NODE_ENV"] !== "production";
  const e = email.trim().toLowerCase();
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((item) => (item.startsWith("@") ? e.endsWith(item) : e === item));
}

function generateOtp(): string {
  // Com e-mail configurado: código aleatório de 6 dígitos. Sem e-mail (alpha): código fixo 123456.
  return emailEnabled() ? crypto.randomInt(100000, 1000000).toString() : "123456";
}

/** Gera, guarda e envia o código. Retorna false se o e-mail estava configurado e o envio falhou. */
async function issueOtp(email: string): Promise<boolean> {
  const code = generateOtp();
  otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, sentAt: Date.now() });
  if (!emailEnabled()) {
    console.log(`[DEV] OTP para ${email}: ${code}`);
    return true;
  }
  return sendOtpEmail(email, code);
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  nome: z.string().min(2, "Nome obrigatório"),
  crm: z.string().min(3, "CRM inválido"),
  uf: z.string().length(2, "UF deve ter 2 letras").toUpperCase(),
  cpf: z.string().min(11, "CPF obrigatório").max(14),
  telefone: z.string().optional(),
  dataNascimento: z.string().min(8, "Data de nascimento obrigatória").max(10),
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

  const { email, senha, nome, crm, uf, telefone, dataNascimento } = parse.data;
  // CPF e data de nascimento são obrigatórios (exigidos para emissão de receitas — RDC 1000/25)
  const cpf = onlyDigits(parse.data.cpf);
  if (!isValidCpf(cpf)) {
    return res.status(400).json({ error: "CPF inválido", code: "INVALID_CPF" });
  }
  const birthDate = parseBirthDate(dataNascimento);
  if (!birthDate) {
    return res.status(400).json({ error: "Data de nascimento inválida (use DD/MM/AAAA)", code: "INVALID_BIRTH_DATE" });
  }

  if (!signupAllowed(email)) {
    return res.status(403).json({
      error: "Cadastro disponível apenas por convite durante o alpha. Peça seu acesso à equipe EcoHealth.",
      code: "SIGNUP_BY_INVITE",
    });
  }
  const crmFormatado = normalizeCrm(uf, crm);
  const nomeSanitizado = sanitizeNome(nome);

  try {
    // Verifica duplicatas
    const [emailExiste, crmExiste, cpfExiste] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { crm: crmFormatado } }),
      prisma.user.findFirst({ where: { cpf } }),
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
        name: nomeSanitizado,
        crm: crmFormatado,
        password: passwordHash,
        cpf,
        birthDate,
        ...(telefone ? { phone: telefone } : {}),
      },
    });

    // Gera, armazena e envia o código de verificação
    const enviado = await issueOtp(email);

    return res.status(201).json({
      success: true,
      userId: user.id,
      // true = modo alpha (código fixo, nada enviado). O frontend só mostra a dica do código neste caso.
      alphaOtp: !emailEnabled(),
      message: enviado
        ? "Código de verificação enviado para o email."
        : "Conta criada, mas não conseguimos enviar o código agora. Use \"Reenviar código\".",
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

  const remoteIp = req.ip ?? "unknown";

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

    if (!user.isVerified) {
      return res.status(403).json({
        error: "Conta ainda não verificada. Conclua a verificação do código para entrar.",
        code: "NOT_VERIFIED",
      });
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

  // Verifica OTP. O atalho "123456" sem código guardado só existe no modo alpha (sem e-mail configurado).
  const stored = otpStore.get(email);
  if (stored && stored.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(email);
    return res.status(429).json({ error: "Muitas tentativas. Peça um novo código.", code: "OTP_TOO_MANY_ATTEMPTS" });
  }
  const codigoOk =
    stored !== undefined
      ? stored.expiresAt > Date.now() &&
        stored.code.length === otp.length &&
        crypto.timingSafeEqual(Buffer.from(stored.code), Buffer.from(otp))
      : !emailEnabled() && otp === "123456";

  if (!codigoOk) {
    if (stored) stored.attempts += 1;
    return res.status(400).json({ error: "Código inválido ou expirado", code: "INVALID_OTP" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado", code: "USER_NOT_FOUND" });
    }

    // Conta já verificada: NUNCA entregar token aqui (antes isto permitia entrar em qualquer
    // conta só com o e-mail + código fixo, sem senha). Quem já verificou entra por /login.
    if (user.isVerified) {
      otpStore.delete(email);
      return res.status(409).json({
        error: "Esta conta já foi verificada. Entre com seu e-mail e senha.",
        code: "ALREADY_VERIFIED",
      });
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

  const anterior = otpStore.get(email);
  if (anterior && Date.now() - anterior.sentAt < OTP_RESEND_MS) {
    return res.status(429).json({ error: "Aguarde um minuto para pedir um novo código.", code: "OTP_RESEND_TOO_SOON" });
  }

  const enviado = await issueOtp(email);
  if (!enviado) {
    return res.status(502).json({ error: "Não foi possível enviar o código agora. Tente novamente em instantes.", code: "EMAIL_SEND_FAILED" });
  }

  return res.json({ success: true, message: "Novo código enviado." });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

router.post("/logout", authenticate, (req: AuthRequest, res: Response) => {
  const token = req.token!;
  revokeToken(token, getTokenExpiry(token));
  return res.json({ success: true });
});

// ─── POST /api/auth/lgpd-consent ─────────────────────────────────────────────

const lgpdConsentSchema = z.object({
  acceptLgpd: z.literal(true),
  acceptTerms: z.literal(true),
});

router.post("/lgpd-consent", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Aceite obrigatório e explícito dos DOIS itens — validado também no servidor
    const parsed = lgpdConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "É necessário aceitar a Política de Privacidade (LGPD) e os Termos de Uso para continuar.",
        code: "CONSENT_INCOMPLETE",
      });
    }

    const existing = await prisma.lgpdConsent.findFirst({
      where: { userId: req.userId!, version: CURRENT_CONSENT_VERSION },
      select: { id: true, acceptedAt: true, version: true },
    });
    if (existing) {
      return res.json({ success: true, consent: existing, alreadyConsented: true });
    }

    const ipAddress = req.ip ?? "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";

    const consent = await prisma.lgpdConsent.create({
      data: {
        userId: req.userId!,
        ipAddress: encryptField(ipAddress) ?? ipAddress,
        userAgent: encryptField(userAgent) ?? userAgent,
        version: CURRENT_CONSENT_VERSION,
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
      where: { userId: req.userId!, version: CURRENT_CONSENT_VERSION },
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
      select: {
        id: true, email: true, name: true, crm: true, isVerified: true, createdAt: true,
        cpf: true, phone: true, birthDate: true, specialty: true, city: true,
        workplaceName: true, workplaceAddress: true, workplacePhone: true, workplaceCity: true, workplaceUf: true,
      },
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

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────
// Completa os dados profissionais do médico. Campos ausentes não são alterados.

const optText = (max: number) => z.string().trim().max(max).optional();
const profileSchema = z.object({
  cpf: optText(14),
  birthDate: optText(10),
  phone: optText(20),
  specialty: optText(100),
  city: optText(100),
  workplaceName: optText(150),
  workplaceAddress: optText(250),
  workplacePhone: optText(20),
  workplaceCity: optText(100),
  workplaceUf: z.string().trim().length(2).toUpperCase().optional().or(z.literal("")),
});

router.patch("/me", authenticate, async (req: AuthRequest, res: Response) => {
  const parse = profileSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors[0]?.message ?? "Dados inválidos", code: "VALIDATION_ERROR" });
  }
  const b = parse.data;
  const data: Record<string, unknown> = {};

  if (b.cpf !== undefined) {
    const cpf = onlyDigits(b.cpf);
    if (!isValidCpf(cpf)) return res.status(400).json({ error: "CPF inválido", code: "INVALID_CPF" });
    const dono = await prisma.user.findFirst({ where: { cpf, NOT: { id: req.userId! } }, select: { id: true } });
    if (dono) return res.status(409).json({ error: "CPF já cadastrado", code: "CPF_EXISTS" });
    data["cpf"] = cpf;
  }
  if (b.birthDate !== undefined) {
    const d = parseBirthDate(b.birthDate);
    if (!d) return res.status(400).json({ error: "Data de nascimento inválida", code: "INVALID_BIRTH_DATE" });
    data["birthDate"] = d;
  }
  for (const k of ["phone", "specialty", "city", "workplaceName", "workplaceAddress", "workplacePhone", "workplaceCity", "workplaceUf"] as const) {
    if (b[k] !== undefined) data[k] = b[k] || null;
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data,
      select: {
        id: true, email: true, name: true, crm: true, isVerified: true, createdAt: true,
        cpf: true, phone: true, birthDate: true, specialty: true, city: true,
        workplaceName: true, workplaceAddress: true, workplacePhone: true, workplaceCity: true, workplaceUf: true,
      },
    });
    await prisma.auditLog
      .create({ data: { userId: req.userId!, action: "PROFILE_UPDATED", resource: "auth", ipAddress: req.ip ?? "unknown", success: true, metadata: { fields: Object.keys(data) } } })
      .catch(() => {});
    return res.json({ success: true, user });
  } catch (err) {
    console.error("update me:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

export default router;
