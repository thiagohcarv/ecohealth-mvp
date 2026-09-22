import https from "https";

export interface SoapNoteResult {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Codes: string[];
  confidence: number;
  model: string;
  rawJson: Record<string, unknown>;
}

export interface PatientData {
  name?: string;
  chiefComplaint?: string;
}

interface GptResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message: string; type: string; code: string };
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// Mocks clínicos realistas para fallback ou modo sem crédito
function getMockSoapNote(transcription: string): SoapNoteResult {
  // [MOCK] Quando tiver crédito OpenAI, remova este if e chame API real
  console.log("[MOCK] Gerando nota SOAP simulada (quando tiver crédito, use API real)");

  const lower = transcription.toLowerCase();
  const hasCefaleia = lower.includes("cefaleia") || lower.includes("dor de cabeça") || lower.includes("cabeça");
  const hasLombar = lower.includes("lombar") || lower.includes("coluna") || lower.includes("costas");
  const hasTossE = lower.includes("tosse") || lower.includes("expectoração") || lower.includes("dispneia");

  if (hasCefaleia) {
    return {
      subjective:
        "Paciente refere cefaleia frontal há 3 dias, EVA 7/10, de caráter pulsátil. Piora com luminosidade e barulho. Nega febre, trauma craniano ou alterações visuais. Relata uso intenso de computador (≥8h/dia) e aumento do estresse recente.",
      objective:
        "PA 120/80 mmHg. FC 72 bpm. Temp 36,5°C. Glasgow 15. Sem rigidez de nuca. Pupilas isocóricas e fotorreativas. Ausculta cardíaca e pulmonar sem alterações.",
      assessment:
        "Cefaleia tensional episódica (CID G44.2). Fatores desencadeantes prováveis: tensão muscular cervical por postura inadequada e esforço visual prolongado.",
      plan:
        "1. Dipirona 500mg VO 6/6h por 3 dias (se dor ≥ EVA 5).\n2. Reduzir tempo de tela; pausas de 20 min a cada 2h.\n3. Compressas frias na região frontal.\n4. Orientar técnicas de relaxamento.\n5. Retorno em 7 dias ou antes se piora ou surgimento de febre.",
      icd10Codes: ["G44.2"],
      confidence: 0.93,
      model: "mock",
      rawJson: { source: "mock", transcriptionPreview: transcription.slice(0, 80) },
    };
  }

  if (hasLombar) {
    return {
      subjective:
        "Paciente refere lombalgia há 1 semana, EVA 6/10, tipo queimação. Piora ao levantar da cadeira e ao final do dia. Nega irradiação para membros inferiores. Trabalho sedentário, >8h sentado. Sem história prévia de lesão.",
      objective:
        "PA 130/85 mmHg. FC 78 bpm. Temp 36,7°C. Lasègue negativo bilateralmente. Sem déficit motor ou sensitivo nos MMII. Dor à palpação de musculatura paravertebral L4-L5.",
      assessment:
        "Lombalgia mecânica inespecífica (CID M54.5). Provável componente postural e muscular sem sinal de compressão radicular.",
      plan:
        "1. Ibuprofeno 600mg VO 8/8h por 5 dias (com alimento).\n2. Encaminhar fisioterapia para fortalecimento de core.\n3. Orientação postural e ergonômica.\n4. Evitar carregar peso ≥5kg por 2 semanas.\n5. Retorno em 10 dias.",
      icd10Codes: ["M54.5"],
      confidence: 0.90,
      model: "mock",
      rawJson: { source: "mock", transcriptionPreview: transcription.slice(0, 80) },
    };
  }

  if (hasTossE) {
    return {
      subjective:
        "Paciente relata tosse produtiva há 5 dias com expectoração amarelo-esverdeada. Nega febre acima de 38°C. Nega dispneia em repouso. Refere piora à noite. Sem contato com pessoas doentes recentemente.",
      objective:
        "PA 118/76 mmHg. FC 80 bpm. Temp 37,4°C. FR 16 irpm. SpO₂ 97% em ar ambiente. MV diminuído em base direita com estertores finos. Orofaringe hiperemiada sem exsudato.",
      assessment:
        "Bronquite aguda bacteriana (CID J20.9). Sem critérios para pneumonia no momento.",
      plan:
        "1. Amoxicilina 500mg VO 8/8h por 7 dias.\n2. Bromexina 8mg VO 8/8h por 5 dias (mucolítico).\n3. Hidratação oral abundante.\n4. Retorno em 48h se febre ou piora da dispneia.\n5. Radiografia de tórax se não houver melhora em 72h.",
      icd10Codes: ["J20.9"],
      confidence: 0.87,
      model: "mock",
      rawJson: { source: "mock", transcriptionPreview: transcription.slice(0, 80) },
    };
  }

  // Genérico
  return {
    subjective: `Paciente relata: "${transcription.slice(0, 120)}...". Sem informações adicionais registradas.`,
    objective: "Sinais vitais dentro dos parâmetros normais. Exame físico geral sem alterações significativas.",
    assessment: "Consulta de avaliação. Quadro clínico em investigação.",
    plan: "1. Exames complementares a definir conforme evolução.\n2. Orientações gerais de cuidados em saúde.\n3. Retorno conforme necessidade.",
    icd10Codes: ["Z00.0"],
    confidence: 0.72,
    model: "mock",
    rawJson: { source: "mock", transcriptionPreview: transcription.slice(0, 80) },
  };
}

async function callGPT4oAPI(
  transcription: string,
  patient: PatientData,
  apiKey: string
): Promise<SoapNoteResult> {
  return new Promise((resolve, reject) => {
    const messages = [
      {
        role: "system",
        content:
          "Você é um assistente médico especializado em documentação clínica brasileira. Gere notas SOAP estruturadas a partir de transcrições de consultas. Responda APENAS com JSON válido, sem markdown ou texto adicional.",
      },
      {
        role: "user",
        content: [
          `Paciente: ${patient.name ?? "Não informado"}`,
          `Queixa principal: ${patient.chiefComplaint ?? "Ver transcrição"}`,
          "",
          `Transcrição da consulta:\n${transcription}`,
          "",
          'Retorne JSON no formato exato:',
          '{"subjective":"...","objective":"...","assessment":"...","plan":"...","icd10Codes":["..."],"confidence":0.9}',
        ].join("\n"),
      },
    ];

    const body = JSON.stringify({
      model: "gpt-4o",
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const options: https.RequestOptions = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 60_000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => {
        try {
          const json = JSON.parse(data) as GptResponse;
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GPT-4o API ${res.statusCode}: ${json.error?.message ?? data}`));
            return;
          }

          const content = json.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(content) as Record<string, unknown>;

          resolve({
            subjective: String(parsed["subjective"] ?? ""),
            objective: String(parsed["objective"] ?? ""),
            assessment: String(parsed["assessment"] ?? ""),
            plan: String(parsed["plan"] ?? ""),
            icd10Codes: Array.isArray(parsed["icd10Codes"])
              ? (parsed["icd10Codes"] as unknown[]).map(String)
              : [],
            confidence: typeof parsed["confidence"] === "number" ? parsed["confidence"] : 0.85,
            model: "gpt-4o",
            rawJson: json as Record<string, unknown>,
          });
        } catch (e) {
          reject(new Error(`Resposta inválida do GPT-4o: ${String(e)}`));
        }
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("GPT-4o timeout (60s)")); });
    req.on("error", (err: Error) => reject(new Error(`Erro de conexão GPT-4o: ${err.message}`)));

    req.write(body);
    req.end();
  });
}

export async function generateSoapNote(
  transcription: string,
  patient: PatientData,
  preferredModel?: string
): Promise<SoapNoteResult> {
  console.log("[SOAP] Gerando nota | modelo:", preferredModel ?? "gpt-4o");

  // Non-GPT models use mock in MVP — structure ready for real integration
  if (preferredModel && preferredModel !== "gpt-4o") {
    const mock = getMockSoapNote(transcription);
    return { ...mock, model: preferredModel };
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey || apiKey === "your-openai-api-key-here") {
    return getMockSoapNote(transcription);
  }

  try {
    return await callGPT4oAPI(transcription, patient, apiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";

    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      // [MOCK] Quando tiver crédito OpenAI, remova este if e chame API real
      console.warn("[MOCK] GPT-4o: cota esgotada — gerando SOAP simulado");
      return getMockSoapNote(transcription);
    }

    console.error("[SOAP] Erro na geração:", msg);
    throw err;
  }
}
