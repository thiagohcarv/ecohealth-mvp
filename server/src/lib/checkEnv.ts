interface EnvRule {
  key: string;
  minLength: number;
}

const REQUIRED: EnvRule[] = [
  { key: "DATABASE_URL",    minLength: 10 },
  { key: "JWT_SECRET",      minLength: 32 },
  { key: "ENCRYPTION_KEY",  minLength: 32 },
];

// S3 é opcional em dev — sem estas variáveis, o áudio cai no fallback local (/tmp/ecohealth/audio)
const OPTIONAL_AWS: string[] = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_S3_BUCKET", "AWS_REGION"];

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

  const missingAws = OPTIONAL_AWS.filter((key) => !process.env[key]);
  if (missingAws.length > 0) {
    console.warn(
      `[ENV] AVISO — S3 não configurado (${missingAws.join(", ")}). Áudio será salvo localmente em /tmp/ecohealth/audio.`
    );
  } else {
    console.log("[ENV] ✓ AWS S3 configurado");
  }
}
