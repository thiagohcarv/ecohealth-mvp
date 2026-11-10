import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "./auth";

/**
 * Bloqueia o acesso a dados clínicos enquanto o cadastro do médico estiver incompleto.
 * CPF e data de nascimento são obrigatórios (exigidos para emissão de receitas — RDC 1000/25).
 * Deve vir depois de `authenticate`.
 */
export async function profileRequired(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { cpf: true, birthDate: true },
    });

    if (!user?.cpf || !user.birthDate) {
      res.status(403).json({
        error: "Complete seu cadastro (CPF e data de nascimento) para continuar.",
        code: "PROFILE_INCOMPLETE",
        completeUrl: "/completar-cadastro",
      });
      return;
    }

    next();
  } catch (err) {
    console.error("profileRequired:", err);
    res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
  }
}
