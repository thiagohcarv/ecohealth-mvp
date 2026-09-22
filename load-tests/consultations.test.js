// load-tests/consultations.test.js
// ECO-31 — Load test dos endpoints principais de consultas e pacientes.
//
// Roda com: npm run test:load:api
// Ver load-tests/README.md antes de rodar (LOAD_TEST_MODE, pool de usuários).

import { check, group, sleep } from "k6";
import http from "k6/http";
import { BASE_URL, DEFAULT_STAGES, DEFAULT_THRESHOLDS, jsonHeaders, provisionPool, safeJson, thinkTime } from "./config.js";

export const options = {
  stages: DEFAULT_STAGES,
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  const users = provisionPool();
  if (users.length === 0) {
    throw new Error("Nenhum usuário de teste pôde ser provisionado — abortando.");
  }
  return { users };
}

export default function (data) {
  const user = data.users[__VU % data.users.length];
  const headers = jsonHeaders(user.token);

  group("GET /api/consultations (lista)", () => {
    const res = http.get(`${BASE_URL}/api/consultations?limit=20`, { headers, tags: { name: "list_consultations" } });
    check(res, {
      "status é 200": (r) => r.status === 200,
      "retornou array de consultas": (r) => Array.isArray(safeJson(r)?.consultations),
    });
  });

  sleep(thinkTime());

  let consultationId = null;

  group("POST /api/consultations (criar)", () => {
    const payload = JSON.stringify({
      patientName: `Paciente Load Test ${__VU}-${__ITER}`,
      chiefComplaint: "Cefaleia — gerado por teste de carga",
    });
    const res = http.post(`${BASE_URL}/api/consultations`, payload, { headers, tags: { name: "create_consultation" } });
    const ok = check(res, {
      "status é 201": (r) => r.status === 201,
      "retornou id da consulta": (r) => Boolean(safeJson(r)?.consultation?.id),
    });
    if (ok) consultationId = safeJson(res)?.consultation?.id ?? null;
  });

  sleep(thinkTime());

  if (consultationId) {
    group("GET /api/consultations/:id (detalhes)", () => {
      const res = http.get(`${BASE_URL}/api/consultations/${consultationId}`, {
        headers,
        tags: { name: "get_consultation" },
      });
      check(res, {
        "status é 200": (r) => r.status === 200,
        "retornou a consulta correta": (r) => safeJson(r)?.consultation?.id === consultationId,
      });
    });
  }

  sleep(thinkTime());

  group("GET /api/patients (lista)", () => {
    const res = http.get(`${BASE_URL}/api/patients`, { headers, tags: { name: "list_patients" } });
    check(res, {
      "status é 200": (r) => r.status === 200,
      "retornou array de pacientes": (r) => Array.isArray(safeJson(r)?.patients),
    });
  });

  sleep(thinkTime());
}
