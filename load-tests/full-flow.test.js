// load-tests/full-flow.test.js
// ECO-31 — Fluxo completo end-to-end: login → criar consulta → gerar SOAP →
// assinar PDF. Simula o uso real de um médico alpha durante o MVP.
//
// Roda com: npm run test:load
// Ver load-tests/README.md antes de rodar (LOAD_TEST_MODE, pool de usuários).

import { check, group, sleep } from "k6";
import http from "k6/http";
import {
  BASE_URL,
  DEFAULT_THRESHOLDS,
  authHeaders,
  credentialsFor,
  fakeAudioFile,
  jsonHeaders,
  provisionPool,
  safeJson,
  thinkTime,
} from "./config.js";

// 20 usuários simultâneos, um fluxo completo cada — uma "onda" de médicos
// usando o app ao mesmo tempo, não 20 médicos em loop contínuo.
export const options = {
  scenarios: {
    full_flow: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 1,
      maxDuration: "3m",
    },
  },
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  const users = provisionPool();
  if (users.length === 0) {
    throw new Error("Nenhum usuário de teste pôde ser provisionado — abortando.");
  }
  return { users };
}

// `data` (retorno de setup()) não é usado diretamente aqui — o próprio ponto do
// teste é medir o login. setup() ainda é necessário para garantir de antemão
// que as contas do pool existem e têm consentimento LGPD registrado.
export default function () {
  const creds = credentialsFor(__VU);
  let token = null;
  let consultationId = null;

  group("1. Login", () => {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: creds.email, senha: creds.senha }),
      { headers: jsonHeaders(), tags: { name: "flow_login" } }
    );
    const ok = check(res, {
      "login: status é 200": (r) => r.status === 200,
      "login: possui token": (r) => Boolean(safeJson(r)?.token),
    });
    if (ok) token = safeJson(res)?.token;
  });

  if (!token) return; // sem login, não faz sentido seguir o fluxo

  sleep(thinkTime());

  group("2. Criar consulta", () => {
    const res = http.post(
      `${BASE_URL}/api/consultations`,
      JSON.stringify({ patientName: `Paciente Fluxo Completo ${__VU}`, chiefComplaint: "Cefaleia frontal" }),
      { headers: jsonHeaders(token), tags: { name: "flow_create_consultation" } }
    );
    const ok = check(res, {
      "criar consulta: status é 201": (r) => r.status === 201,
      "criar consulta: possui id": (r) => Boolean(safeJson(r)?.consultation?.id),
    });
    if (ok) consultationId = safeJson(res)?.consultation?.id;
  });

  if (!consultationId) return;

  sleep(thinkTime());

  let transcribed = false;

  group("3. Transcrever áudio", () => {
    const form = { audioFile: fakeAudioFile() };
    const res = http.patch(`${BASE_URL}/api/consultations/${consultationId}/transcribe`, form, {
      headers: authHeaders(token),
      tags: { name: "flow_transcribe" },
    });
    transcribed = check(res, {
      "transcrever: status é 200": (r) => r.status === 200,
    });
  });

  if (!transcribed) return;

  sleep(thinkTime());

  let soapGenerated = false;

  group("4. Gerar SOAP", () => {
    const res = http.post(`${BASE_URL}/api/consultations/${consultationId}/generate-soap`, null, {
      headers: jsonHeaders(token),
      tags: { name: "flow_generate_soap" },
    });
    soapGenerated = check(res, {
      "gerar SOAP: status é 200": (r) => r.status === 200,
      "gerar SOAP: retornou nota": (r) => Boolean(safeJson(r)?.soapNote?.assessment),
    });
  });

  if (!soapGenerated) return;

  sleep(thinkTime());

  group("5. Assinar PDF", () => {
    const res = http.post(`${BASE_URL}/api/consultations/${consultationId}/sign`, null, {
      headers: jsonHeaders(token),
      tags: { name: "flow_sign_pdf" },
    });
    check(res, {
      "assinar PDF: status é 200": (r) => r.status === 200,
      "assinar PDF: retornou PDF": (r) => (r.headers["Content-Type"] || "").includes("application/pdf"),
    });
  });

  sleep(thinkTime());
}
