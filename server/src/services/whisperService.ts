import fs from "fs";
import https from "https";
import FormData from "form-data";

export interface TranscriptionResult {
  text: string;
  duration: number;
  language: string;
}

interface WhisperVerboseResponse {
  text: string;
  duration?: number;
  language?: string;
  error?: { message: string; type: string; code: string };
}

// Transcrições mock realistas para diferentes situações clínicas
const MOCK_TRANSCRIPTIONS = [
  "Paciente relata cefaleia frontal há 3 dias de forte intensidade, EVA 7. Piora com luz e barulho. Nega febre ou trauma craniano. Usa computador aproximadamente 8 horas por dia. Pressão arterial 120 por 80, frequência cardíaca 72, temperatura 36,5. Ausculta cardíaca e pulmonar normais.",
  "Paciente vem com queixa de dor lombar há uma semana, tipo queimação, EVA 6. Piora ao se levantar da cadeira. Nega irradiação para membros inferiores. Trabalho sedentário com mais de 6 horas sentado por dia. Exame físico sem déficits neurológicos.",
  "Paciente relata tosse produtiva há 5 dias com expectoração amarelada. Nega febre acima de 38. Nega dispneia em repouso. Ausculta com murmúrio vesicular diminuído em base direita. Saturação 97% em ar ambiente.",
];

function getMockTranscription(): TranscriptionResult {
  const idx = Math.floor(Math.random() * MOCK_TRANSCRIPTIONS.length);
  const text = MOCK_TRANSCRIPTIONS[idx] ?? MOCK_TRANSCRIPTIONS[0]!;
  // [MOCK] Quando tiver crédito OpenAI, remova este bloco e chame API real
  console.warn("[MOCK] Transcrição simulada (quando tiver crédito, mude para real)");
  return { text, duration: 42, language: "pt" };
}

async function callWhisperAPI(audioPath: string, apiKey: string): Promise<WhisperVerboseResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", fs.createReadStream(audioPath), {
      filename: "audio.webm",
      contentType: "audio/webm",
    });
    form.append("model", "whisper-1");
    form.append("language", "pt");
    form.append("response_format", "verbose_json");

    const options: https.RequestOptions = {
      hostname: "api.openai.com",
      path: "/v1/audio/transcriptions",
      method: "POST",
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 60_000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => {
        try {
          const json = JSON.parse(body) as WhisperVerboseResponse;
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Whisper API ${res.statusCode}: ${json.error?.message ?? body}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`Resposta inválida: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("Whisper timeout (60s)")); });
    req.on("error", (err: Error) => reject(new Error(`Erro de conexão: ${err.message}`)));

    form.pipe(req);
  });
}

export async function transcribeAudio(
  audioPath: string,
  consultationId: string
): Promise<TranscriptionResult> {
  console.log(`[Whisper] Iniciando | consultationId=${consultationId}`);

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey || apiKey === "your-openai-api-key-here") {
    return getMockTranscription();
  }

  const MAX_RETRIES = 2;
  let lastError: Error = new Error("Erro desconhecido");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callWhisperAPI(audioPath, apiKey);
      const duration = response.duration ?? 0;
      const language = response.language ?? "pt";
      console.log(`[Whisper] Concluído | consultationId=${consultationId} | duração=${duration}s`);
      return { text: response.text, duration, language };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;

      if (msg.includes("429")) {
        // [MOCK] Quando tiver crédito OpenAI, remova este if e chame API real
        console.warn(`[MOCK] Cota Whisper esgotada na tentativa ${attempt} — usando transcrição simulada`);
        return getMockTranscription();
      }

      if (msg.includes("401") || msg.includes("403") || msg.includes("400")) {
        console.error(`[Whisper] Erro definitivo: ${msg}`);
        throw lastError;
      }

      console.warn(`[Whisper] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${msg}`);
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }

  throw lastError;
}
