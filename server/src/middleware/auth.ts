import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { isTokenRevoked } from "../lib/tokenBlacklist";

export interface AuthRequest extends Request {
  userId?: string;
  token?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token ausente", code: "TOKEN_MISSING" });
    return;
  }

  const token = header.slice(7);

  if (isTokenRevoked(token)) {
    res.status(401).json({ error: "Token revogado", code: "TOKEN_REVOKED" });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.token = token;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado", code: "TOKEN_INVALID" });
  }
}
