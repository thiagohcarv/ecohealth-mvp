import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { createCheckoutSession, handleWebhook, checkTrialStatus } from "../services/stripeService";

const router = Router();

// ─── GET /api/billing/status ──────────────────────────────────────────────────

router.get("/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { plan: true, trialEndsAt: true, stripeSubscriptionId: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado", code: "USER_NOT_FOUND" });
    }

    const { isExpired, daysRemaining } = checkTrialStatus(user.trialEndsAt, user.plan);

    return res.json({
      success: true,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      daysRemaining,
      isExpired,
    });
  } catch (err) {
    console.error("billing/status:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/billing/checkout ───────────────────────────────────────────────

router.post("/checkout", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { email: true, plan: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado", code: "USER_NOT_FOUND" });
    }

    if (user.plan === "pro") {
      return res.status(400).json({ error: "Usuário já possui plano Pro", code: "ALREADY_PRO" });
    }

    const session = await createCheckoutSession(req.userId!, user.email);

    return res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("billing/checkout:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/billing/webhook ────────────────────────────────────────────────

const webhookSchema = z.object({
  type: z.string().min(1, "Tipo de evento obrigatório"),
  data: z.record(z.unknown()).optional().default({}),
});

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const parse = webhookSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Evento inválido", code: "INVALID_EVENT" });
    }

    const event = parse.data;

    if (event.type === "checkout.session.completed") {
      const userId = event.data?.["userId"] as string | undefined;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: "pro",
            stripeSubscriptionId: `mock_sub_${userId}_${Date.now()}`,
          },
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const userId = event.data?.["userId"] as string | undefined;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: "trial", stripeSubscriptionId: null },
        });
      }
    }

    const result = await handleWebhook({ type: event.type, data: event.data ?? {} });
    return res.json({ success: true, handled: result.handled });
  } catch (err) {
    console.error("billing/webhook:", err);
    return res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
});

export default router;
