import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "./auth";

export async function lgpdRequired(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const consent = await prisma.lgpdConsent.findFirst({
      where: { userId: req.userId! },
      select: { id: true },
    });

    if (!consent) {
      res.status(403).json({
        error: "Consentimento LGPD necessário para continuar.",
        code: "LGPD_CONSENT_REQUIRED",
        consentUrl: "/lgpd",
      });
      return;
    }

    next();
  } catch (err) {
    console.error("lgpdRequired:", err);
    res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
}
