import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "./auth";
import { checkTrialStatus } from "../services/stripeService";

export async function checkPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { plan: true, trialEndsAt: true },
    });

    if (!user) {
      res.status(401).json({ error: "Usuário não encontrado", code: "USER_NOT_FOUND" });
      return;
    }

    const { isExpired } = checkTrialStatus(user.trialEndsAt, user.plan);

    if (isExpired) {
      res.status(403).json({
        error: "Trial expirado. Assine o Plano Pro para continuar.",
        code: "TRIAL_EXPIRED",
        upgradeUrl: "/configuracoes",
      });
      return;
    }

    next();
  } catch (err) {
    console.error("checkPlan:", err);
    res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
}
