interface EnvRule {
  key: string;
  minLength: number;
}

const REQUIRED: EnvRule[] = [
  { key: "DATABASE_URL",    minLength: 10 },
  { key: "JWT_SECRET",      minLength: 32 },
  { key: "ENCRYPTION_KEY",  minLength: 32 },
];

/**
 * Validates required environment variables at server startup.
 * Exits with code 1 if any are missing or too short — prevents the server
 * from starting without the credentials needed to protect medical data.
 */
export function checkEnv(): void {
  const missing: string[] = [];
  const weak: string[] = [];

  for (const { key, minLength } of REQUIRED) {
    const val = process.env[key];
    if (!val) {
      missing.push(key);
    } else if (val.length < minLength) {
      weak.push(`${key} (mínimo ${minLength} chars, atual: ${val.length})`);
    } else {
      console.log(`[ENV] ✓ ${key} (${val.length} chars)`);
    }
  }

  if (missing.length > 0) {
    console.error(`[ENV] ERRO FATAL — variáveis ausentes: ${missing.join(", ")}`);
  }
  if (weak.length > 0) {
    console.error(`[ENV] ERRO FATAL — variáveis muito curtas: ${weak.join(", ")}`);
  }

  if (missing.length > 0 || weak.length > 0) {
    console.error("[ENV] Adicione as variáveis ao server/.env e reinicie.");
    process.exit(1);
  }

  if (process.env["OPENAI_API_KEY"]) {
    console.log("[ENV] ✓ OPENAI_API_KEY");
  } else {
    const demo = process.env["NODE_ENV"] !== "production" || process.env["ALLOW_AI_MOCK"] === "true";
    console.warn(
      demo
        ? "[ENV] AVISO — OPENAI_API_KEY ausente: IA em modo SIMULADO (dados fictícios)."
        : "[ENV] AVISO — OPENAI_API_KEY ausente: transcrição e notas por IA ficarão INDISPONÍVEIS."
    );
  }
}
