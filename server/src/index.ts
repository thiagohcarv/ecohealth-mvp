import "dotenv/config";
import { checkEnv } from "./lib/checkEnv";
checkEnv(); // Exits with code 1 if ENCRYPTION_KEY / JWT_SECRET / DATABASE_URL are missing
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import authRouter from "./routes/auth";
import consultationsRouter from "./routes/consultations";
import billingRouter from "./routes/billing";
import patientsRouter from "./routes/patients";
import auditRouter from "./routes/audit";
import { swaggerSpec } from "./swagger";
import { LOAD_TEST_MODE } from "./lib/loadTestMode";

if (LOAD_TEST_MODE) {
  console.warn(
    "[LOAD_TEST_MODE] ⚠️  Rate limits elevados para teste de carga (k6). NUNCA use isso em produção."
  );
}

const app = express();
const PORT = Number(process.env["PORT"] ?? 3001);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// ALLOWED_ORIGINS: comma-separated list for multi-domain (staging + prod)
// Falls back to NEXT_PUBLIC_APP_URL, then localhost:3000 for local dev
const allowedOrigins = (
  process.env["ALLOWED_ORIGINS"] ??
  process.env["NEXT_PUBLIC_APP_URL"] ??
  "http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin '${origin}' blocked by CORS policy`));
    },
    credentials: true,
  })
);

// ─── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    // CSP: API-only server — no HTML to protect, keep permissive
    contentSecurityPolicy: false,
    // X-Frame-Options: DENY
    frameguard: { action: "deny" },
    // X-Content-Type-Options: nosniff
    noSniff: true,
    // Referrer-Policy: strict-origin-when-cross-origin
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // HSTS: 1 year, include subdomains
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
    // Hide X-Powered-By
    hidePoweredBy: true,
  })
);
// Permissions-Policy: allow microphone only from same origin (needed for audio recording)
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "microphone=(self)");
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// General: 100 req / 15 min per IP (raised under LOAD_TEST_MODE — see lib/loadTestMode.ts)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: LOAD_TEST_MODE ? 100_000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health",
    message: { error: "Muitas requisições. Tente novamente em alguns minutos.", code: "RATE_LIMIT_EXCEEDED" },
  })
);

// Auth: 5 attempts / 15 min per IP — brute-force protection (raised under LOAD_TEST_MODE)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: LOAD_TEST_MODE ? 100_000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Muitas tentativas de autenticação. Tente novamente em 15 minutos.", code: "AUTH_RATE_LIMIT" },
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env["NODE_ENV"] });
});

// ─── Docs ─────────────────────────────────────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "EcoHealth API Docs",
  swaggerOptions: { persistAuthorization: true },
}));
app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/consultations", consultationsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/audit", auditRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada", code: "NOT_FOUND" });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno", code: "INTERNAL_ERROR" });
});

app.listen(PORT, () => {
  console.log(`EcoHealth API → http://localhost:${PORT}`);
  console.log(`  [ENV] ${process.env["NODE_ENV"] ?? "development"}`);
});

export default app;
