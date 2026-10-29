// Gera PDFs de amostra (dados fictícios) para inspeção visual. Uso: npx tsx scripts/pdf-sample.ts
import { generateSignedPdf } from "../src/services/pdfSignerService";
import fs from "fs";
import path from "path";

const out = path.join(__dirname, "..", "pdf-out");
fs.mkdirSync(out, { recursive: true });

const soap = {
  subjective: "Paciente refere cefaleia frontal há 3 dias, EVA ≥ 7/10, sem febre. Piora com luminosidade. Nega trauma.",
  objective: "PA 120/80 mmHg. FC 72 bpm. Temp 36,5 °C. Sem rigidez de nuca. Exame neurológico sem alterações.",
  assessment: "Cefaleia tensional episódica (hipótese). Sem sinais de alarme.",
  plan: "1. Dipirona 500 mg VO 6/6h se dor ≥ 5/10.\n2. Reduzir tempo de tela → pausas a cada 2h.\n3. Retorno em 7 dias – ou antes se piora. ✓ orientado",
  icd10Codes: ["G44.2", "R51"],
  confidence: 0.91,
  model: "gpt-4o",
};
const base: any = {
  id: "cmuhq7x2k0001abcd1234efgh",
  date: new Date(),
  chiefComplaint: "Dor de cabeça há três dias",
  patient: { name: "José da Conceição Ávila Nogueira Filho", dateOfBirth: new Date("1985-03-01T12:00:00Z") },
  doctor: { name: "Thiago Carvalho", crm: "123457/SP", email: "thiago2@ecohealth.com" },
  soapNote: soap,
};
(async () => {
  const long = "Texto longo de teste com acentuação: ação, coração, pressão, não, é. ".repeat(40);
  const cases: Record<string, any> = {
    normal: base,
    longo: { ...base, soapNote: { ...soap, subjective: long.repeat(6), objective: long.repeat(4), assessment: long.repeat(3), plan: long.repeat(4) } },
    vazio: { ...base, chiefComplaint: undefined, soapNote: { ...soap, subjective: "", objective: "", assessment: "", plan: "", icd10Codes: [] } },
  };
  for (const [k, v] of Object.entries(cases)) {
    fs.writeFileSync(path.join(out, `${k}.pdf`), await generateSignedPdf(v));
    console.log("ok", k);
  }
})();
