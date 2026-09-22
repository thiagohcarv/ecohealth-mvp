// load-tests/soap.test.js
// ECO-31 — Load test da geração de nota SOAP (POST /:id/generate-soap), o
// endpoint mais pesado da API (depende de IA — latência bem maior que o resto).
//
// Roda com: npm run test:load:soap
// Ver load-tests/README.md antes de rodar (LOAD_TEST_MODE, pool de usuários).

import { check, sleep } from "k6";
import http from "k6/http";
import { BASE_URL, SOAP_THRESHOLDS, authHeaders, fakeAudioFile, jsonHeaders, provisionUser, safeJson, thinkTime } from "./config.js";

// 10 usuários simultâneos, uma geração de SOAP cada — não um loop sustentado.
// Reflete o cenário real: poucos médicos gerando SOAP ao mesmo tempo, não 10
// gerações por médico em 1 minuto (o que estouraria o limite de IA de propósito).
export const options = {
  scenarios: {
    soap_generation: {
      executor: "per-vu-iterations",
      vus: 10,
      iterations: 1,
      maxDuration: "1m",
    },
  },
  thresholds: SOAP_THRESHOLDS,
};

// setup() roda uma vez: cria UMA consulta já transcrita, compartilhada pelos 10
// VUs. Cada VU regenera a mesma nota SOAP — sintético, mas mede exatamente o
// custo do endpoint sob concorrência, que é o objetivo do teste.
export function setup() {
  const user = provisionUser(0);
  if (!user) throw new Error("Não foi possível provisionar o usuário de teste — abortando.");

  const headers = jsonHeaders(user.token);

  const createRes = http.post(
    `${BASE_URL}/api/consultations`,
    JSON.stringify({ patientName: "Paciente SOAP Load Test", chiefComplaint: "Cefaleia" }),
    { headers, tags: { name: "setup_create_consultation" } }
  );
  const consultationId = safeJson(createRes)?.consultation?.id;
  if (!consultationId) throw new Error("Não foi possível criar a consulta de teste — abortando.");

  // generate-soap exige uma transcrição existente — sem OPENAI_API_KEY válida,
  // o backend usa uma transcrição mock automaticamente (instantâneo, sem custo).
  const form = { audioFile: fakeAudioFile() };
  const transcribeRes = http.patch(`${BASE_URL}/api/consultations/${consultationId}/transcribe`, form, {
    headers: authHeaders(user.token),
    tags: { name: "setup_transcribe" },
  });
  if (transcribeRes.status !== 200) {
    throw new Error(`Falha ao transcrever a consulta de teste (status ${transcribeRes.status}) — abortando.`);
  }

  return { token: user.token, consultationId };
}

export default function (data) {
  const headers = jsonHeaders(data.token);

  const res = http.post(`${BASE_URL}/api/consultations/${data.consultationId}/generate-soap`, null, {
    headers,
    tags: { name: "generate_soap" },
  });

  check(res, {
    "status é 200": (r) => r.status === 200,
    "retornou nota SOAP": (r) => Boolean(safeJson(r)?.soapNote?.assessment),
    "não foi bloqueado por rate limit de IA (429)": (r) => r.status !== 429,
  });

  sleep(thinkTime());
}
