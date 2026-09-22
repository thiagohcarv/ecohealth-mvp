// load-tests/auth.test.js
// ECO-31 — Load test do fluxo de autenticação (POST /api/auth/login).
//
// Roda com: npm run test:load:auth
// Ver load-tests/README.md antes de rodar (LOAD_TEST_MODE, pool de usuários).

import { check, sleep } from "k6";
import http from "k6/http";
import {
  BASE_URL,
  DEFAULT_STAGES,
  DEFAULT_THRESHOLDS,
  credentialsFor,
  jsonHeaders,
  provisionPool,
  safeJson,
  thinkTime,
} from "./config.js";

export const options = {
  stages: DEFAULT_STAGES,
  thresholds: DEFAULT_THRESHOLDS,
};

// setup() roda uma única vez, fora da contagem de VUs — é aqui que garantimos
// que as contas do pool existem, sem gerar 50x tentativas de registro.
export function setup() {
  const users = provisionPool();
  if (users.length === 0) {
    throw new Error("Nenhum usuário de teste pôde ser provisionado — abortando.");
  }
  return { users };
}

export default function () {
  // Cada VU reusa uma conta do pool — logins bem-sucedidos não contam contra o
  // rate limit de auth (skipSuccessfulRequests: true no backend).
  const creds = credentialsFor(__VU);

  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: creds.email, senha: creds.senha }),
    { headers: jsonHeaders(), tags: { name: "login" } }
  );

  check(res, {
    "status é 200": (r) => r.status === 200,
    "possui token no response": (r) => Boolean(safeJson(r)?.token),
    "não foi bloqueado por rate limit (429)": (r) => r.status !== 429,
  });

  sleep(thinkTime());
}
