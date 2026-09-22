import jwt from "jsonwebtoken";

function getSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET não configurado ou muito curto");
  }
  return secret;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: "24h" });
}

export function verifyToken(token: string): { sub: string; exp: number } {
  return jwt.verify(token, getSecret()) as { sub: string; exp: number };
}

/** Decodes without verifying signature — use only for reading exp on a token
 *  already validated by verifyToken. */
export function getTokenExpiry(token: string): number {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ? decoded.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;
}
