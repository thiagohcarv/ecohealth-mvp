// load-tests/config.js
// Configuração e helpers compartilhados entre os testes de carga (k6) do ECO-31.

import http from "k6/http";
import { check } from "k6";

// ─── Configuração base ─────────────────────────────────────────────────────────

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

// Rampa padrão: 0 → 50 VUs em 30s, mantém 50 por 1min, desce em 30s (total: 2min)
export const DEFAULT_STAGES = [
  { duration: "30s", target: 50 },
  { duration: "1m", target: 50 },
  { duration: "30s", target: 0 },
];

export const DEFAULT_THRESHOLDS = {
  http_req_duration: ["p(95)<500", "p(99)<1000"],
  http_req_failed: ["rate<0.01"],
};

// Geração de SOAP depende de IA — muito mais lenta que o resto da API.
export const SOAP_THRESHOLDS = {
  http_req_duration: ["p(95)<3000"],
  http_req_failed: ["rate<0.05"],
};

// ─── Usuários de teste ──────────────────────────────────────────────────────────
//
// O login (skipSuccessfulRequests) não penaliza requests bem-sucedidos, então um
// pool pequeno de contas REAIS e REUTILIZÁVEIS pode ser usado por muitos VUs em
// paralelo sem problema. Mantemos o pool em 5 contas por padrão — o mesmo valor
// do limite de tentativas falhas de auth (5/15min) — para que registrar o pool
// repetidamente (em reruns, onde o registro retorna 409) nunca estoure esse
// limite. Ver README.md → "Rate limiting" para o racional completo.
export const POOL_SIZE = Number(__ENV.LOAD_TEST_POOL_SIZE || 5);
export const TEST_PASSWORD = __ENV.TEST_PASSWORD || "LoadTest123!";

/** Credenciais determinísticas — mesmo índice sempre gera o mesmo usuário. */
export function credentialsFor(index) {
  const n = index % POOL_SIZE;
  return {
    email: `loadtest${n}@ecohealth.dev`,
    senha: TEST_PASSWORD,
    nome: `Dr. Load Test ${n}`,
    crm: `${100000 + n}`,
    uf: "SP",
  };
}

// ─── Helpers HTTP ───────────────────────────────────────────────────────────────

export function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Para uploads multipart (ex.: transcrição de áudio) — NÃO defina Content-Type
// manualmente aqui; o k6 precisa gerar o boundary do multipart/form-data sozinho.
export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function safeJson(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

/** Pausa entre 1 e 3s — simula o ritmo de um médico usando o app de verdade. */
export function thinkTime() {
  return Math.random() * 2 + 1;
}

// ─── Provisionamento de contas (usar só em setup(), nunca por VU/iteração) ──────

/** Registra o usuário se ainda não existir (409 é esperado e ignorado). */
export function registerIfNeeded(creds) {
  return http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(creds), {
    headers: jsonHeaders(),
    tags: { name: "setup_register" },
  });
}

/** Faz login e retorna o token JWT (ou null em caso de falha). */
export function login(creds) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: creds.email, senha: creds.senha }),
    { headers: jsonHeaders(), tags: { name: "setup_login" } }
  );
  const body = safeJson(res);
  return body && body.token ? body.token : null;
}

/** Garante o consentimento LGPD — pré-requisito para criar consultas. */
export function ensureLgpdConsent(token) {
  http.post(`${BASE_URL}/api/auth/lgpd-consent`, null, {
    headers: jsonHeaders(token),
    tags: { name: "setup_lgpd_consent" },
  });
}

/**
 * Garante que uma conta de teste exista, está logada e com consentimento LGPD.
 * Chame apenas dentro de setup() — nunca dentro da função default (por VU).
 */
export function provisionUser(index) {
  const creds = credentialsFor(index);
  registerIfNeeded(creds);
  const token = login(creds);

  const ok = check(token, { [`setup: login OK (user ${index % POOL_SIZE})`]: (t) => Boolean(t) });
  if (!ok) return null;

  ensureLgpdConsent(token);
  return { token, ...creds };
}

/** Provisiona o pool inteiro (POOL_SIZE contas) — uma vez, em setup(). */
export function provisionPool() {
  const users = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const user = provisionUser(i);
    if (user) users.push(user);
  }
  return users;
}

/** Um arquivo de áudio "falso" — suficiente para exercitar o endpoint de transcrição. */
export function fakeAudioFile() {
  // multer só exige um arquivo com mimetype válido; o conteúdo em si não importa
  // porque o whisperService cai em transcrição mock quando OPENAI_API_KEY não
  // está configurada (recomendado para load test — ver README.md).
  return http.file("loadtest-audio-bytes", "loadtest.webm", "audio/webm");
}
