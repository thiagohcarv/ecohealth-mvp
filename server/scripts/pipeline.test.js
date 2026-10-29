// Teste do pipeline de IA (Whisper + SOAP) com a OpenAI SIMULADA — não gasta créditos.
// Uso (a partir da raiz do projeto):
//   TS_NODE_PROJECT=server/tsconfig.json TS_NODE_TRANSPILE_ONLY=true node -r ./server/node_modules/ts-node/register server/scripts/pipeline.test.js
const os = require("os"), fs = require("fs"), https = require("https");
const { Writable } = require("stream");
const SRC = require("path").join(__dirname, "..", "src");
let failed = 0;
const check = (nome, cond, extra = "") => { if (!cond) failed++; console.log((cond ? "PASS" : "FAIL") + " - " + nome + (extra && !cond ? "  → " + extra : "")); };

let captured = [], calls = 0;
function stubOpenAI(status, body) {
  calls = 0; captured = [];
  https.request = (opts, cb) => {
    calls++;
    const req = new Writable({
      write(chunk, _e, done) { captured.push(Buffer.from(chunk)); done(); },
      final(done) {
        const { EventEmitter } = require("events");
        const res = new EventEmitter(); res.statusCode = status;
        cb(res); res.emit("data", Buffer.from(JSON.stringify(body))); res.emit("end"); done();
      },
    });
    req.destroy = () => {};
    return req;
  };
}
const sent = () => Buffer.concat(captured).toString("utf8");
const setEnv = (e) => { for (const k of ["NODE_ENV","ALLOW_AI_MOCK","OPENAI_API_KEY"]) delete process.env[k]; Object.assign(process.env, e); };
const rejects = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

(async () => {
  const { AiConfigError } = require(SRC + "/lib/aiMode.ts");
  const { transcribeAudio } = require(SRC + "/services/whisperService.ts");
  const { generateSoapNote } = require(SRC + "/services/soapGeneratorService.ts");
  const audio = Buffer.from("fake-audio-bytes");
  const PHI = "Paciente com dor torácica em aperto";

  console.log("── Produção SEM chave ──");
  setEnv({ NODE_ENV: "production" });
  let e = await rejects(() => transcribeAudio(audio, "c1"));
  check("Whisper recusa (não inventa transcrição)", e instanceof AiConfigError, String(e));
  e = await rejects(() => generateSoapNote(PHI, { name: "X" }));
  check("SOAP recusa (não inventa nota)", e instanceof AiConfigError, String(e));

  console.log("── Produção com ALLOW_AI_MOCK=true (demo) ──");
  setEnv({ NODE_ENV: "production", ALLOW_AI_MOCK: "true" });
  const t = await transcribeAudio(audio, "c1");
  check("transcrição marcada como simulated", t.simulated === true);
  const m = await generateSoapNote("dor de cabeça forte " + PHI, { name: "X" });
  check("nota marcada model=mock", m.model === "mock");
  check("rawJson do mock SEM trecho da transcrição (PHI)", !JSON.stringify(m.rawJson).includes("dor de cabeça"), JSON.stringify(m.rawJson));

  console.log("── Produção + chave + cota esgotada (429) ──");
  setEnv({ NODE_ENV: "production", OPENAI_API_KEY: "sk-test" });
  stubOpenAI(429, { error: { message: "You exceeded your current quota", code: "insufficient_quota" } });
  e = await rejects(() => generateSoapNote(PHI, { name: "X" }));
  check("SOAP com 429 → ERRO (antes devolvia nota fictícia)", e && /429/.test(e.message), String(e));
  stubOpenAI(429, { error: { message: "quota" } });
  e = await rejects(() => transcribeAudio(audio, "c1"));
  check("Whisper com 429 → ERRO (antes devolvia texto fictício)", e && /429/.test(e.message), String(e));

  console.log("── Chave válida: caminho real ──");
  setEnv({ NODE_ENV: "production", OPENAI_API_KEY: "sk-test" });
  const soapJson = { subjective: "Dor torácica em aperto", objective: "Não informado na consulta.", assessment: "Hipótese: angina", plan: "ECG", icd10Codes: ["I20.9"], confidence: 0.8 };
  stubOpenAI(200, { id: "chatcmpl-1", model: "gpt-4o-2024", choices: [{ message: { content: JSON.stringify(soapJson) }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 20 } });
  const r = await generateSoapNote(PHI, { name: "Maria" }, "claude-3.5");
  check("preferência 'claude-3.5' NÃO gera mock: usa gpt-4o real", r.model === "gpt-4o" && calls === 1);
  check("campos S/O/A/P preenchidos", r.subjective && r.assessment.includes("angina") && r.plan === "ECG");
  const raw = JSON.stringify(r.rawJson);
  check("rawJson guarda só metadados (SEM a nota em texto puro)", !raw.includes("Dor torácica") && !raw.includes("angina") && raw.includes("chatcmpl-1"), raw);
  const body = JSON.parse(sent());
  check("prompt proíbe invenção de dados", /NUNCA invente/.test(body.messages[0].content));
  check("prompt manda usar 'Não informado na consulta.'", /Não informado na consulta/.test(body.messages[0].content));
  check("max_tokens 2500 (antes 1000 truncava)", body.max_tokens === 2500);

  stubOpenAI(200, { choices: [{ message: { content: "{\"subjective\":\"abc" }, finish_reason: "length" }] });
  e = await rejects(() => generateSoapNote(PHI, { name: "X" }));
  check("resposta truncada vira erro claro", e && /truncada/.test(e.message), String(e));

  stubOpenAI(200, { text: "paciente com dor de cabeça", duration: 12, language: "pt" });
  const w = await transcribeAudio(audio, "c1", "audio/mp4;codecs=mp4a.40.2");
  check("Whisper real: texto retornado e NÃO simulado", w.text.includes("dor de cabeça") && !w.simulated);
  const form = sent();
  check("Whisper recebe o formato real (mp4), não webm fixo", /filename="audio\.mp4"/.test(form) && /Content-Type: audio\/mp4/.test(form), form.slice(0, 300));

  console.log("── Áudio nunca é armazenado (garantias estáticas) ──");
  const route = fs.readFileSync(SRC + "/routes/consultations.ts", "utf8");
  check("rota não usa S3 nem grava arquivo de áudio", !/uploadAudio|saveLocalAudio|s3Service|writeFileSync|diskStorage|dest:/.test(route));
  check("upload é em memória (memoryStorage)", /memoryStorage\(\)/.test(route));
  check("não existem rotas que sirvam áudio", !/\/:id\/audio/.test(route));
  check("buffer do áudio é zerado ao final", /file\.buffer\.fill\(0\)/.test(route));
  const wsrc = fs.readFileSync(SRC + "/services/whisperService.ts", "utf8");
  check("Whisper recebe Buffer (sem ler arquivo)", !/createReadStream/.test(wsrc));
  console.log(failed ? `\n${failed} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error("ERRO NO TESTE:", err); process.exit(2); });
