// Testes de SEGURANÇA (auth, cadastro, cobrança) — banco falso em memória: sem custo, sem rede.
// Uso (raiz do projeto):
//   TS_NODE_PROJECT=server/tsconfig.json TS_NODE_TRANSPILE_ONLY=true node -r ./server/node_modules/ts-node/register server/scripts/auth.test.js
const path = require("path"), fs = require("fs");
const SRC = path.join(__dirname, "..", "src");
process.env.JWT_SECRET = "j".repeat(40);
process.env.ENCRYPTION_KEY = "e".repeat(40);

// ── prisma falso ──
const users = []; let seq = 0;
const match = (u, w) => Object.entries(w).every(([k, v]) => u[k] === v);
const fakePrisma = {
  user: {
    findUnique: async ({ where }) => users.find((u) => match(u, where)) ?? null,
    findFirst: async ({ where }) => users.find((u) => match(u, where)) ?? null,
    create: async ({ data }) => { const u = { id: "u" + (++seq), isVerified: false, ...data }; users.push(u); return u; },
    update: async ({ where, data }) => { const u = users.find((x) => match(x, where)); Object.assign(u, data); return u; },
  },
  consultation: { findFirst: async () => null },
  auditLog: { create: async () => ({}) },
  lgpdConsent: { findFirst: async () => null, create: async () => ({}) },
};
const prismaPath = require.resolve(SRC + "/lib/prisma.ts");
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: fakePrisma } };

const express = require("express");
let failed = 0;
const check = (nome, cond, extra = "") => { if (!cond) failed++; console.log((cond ? "PASS" : "FAIL") + " - " + nome + (!cond && extra ? "  → " + extra : "")); };
const setEnv = (e) => { for (const k of ["NODE_ENV", "SIGNUP_ALLOWLIST"]) delete process.env[k]; Object.assign(process.env, e); };

(async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/auth", require(SRC + "/routes/auth.ts").default);
  app.use("/api/billing", require(SRC + "/routes/billing.ts").default);
  app.use("/api/consultations", require(SRC + "/routes/consultations.ts").default);
  const server = app.listen(0);
  const base = "http://127.0.0.1:" + server.address().port;
  const call = async (method, url, body, token) => {
    const r = await fetch(base + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = {}; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
  let n = 0;
  const novo = (email) => ({ email, senha: "Senha@123", nome: "Fulano de Tal", crm: "10" + (++n) + "00", uf: "SP", cpf: "000.000." + String(n).padStart(3, "0") + "-00" });

  console.log("── Cadastro por convite ──");
  setEnv({ NODE_ENV: "production" });
  let r = await call("POST", "/api/auth/register", novo("qualquer@x.com"));
  check("produção SEM lista de convidados: cadastro FECHADO (403)", r.status === 403 && r.json.code === "SIGNUP_BY_INVITE", JSON.stringify(r));
  setEnv({ NODE_ENV: "production", SIGNUP_ALLOWLIST: "medico@ok.com, @clinica.com" });
  r = await call("POST", "/api/auth/register", novo("medico@ok.com"));
  check("e-mail convidado consegue cadastrar (201)", r.status === 201, JSON.stringify(r));
  r = await call("POST", "/api/auth/register", novo("intruso@evil.com"));
  check("e-mail NÃO convidado é barrado (403)", r.status === 403, JSON.stringify(r));
  r = await call("POST", "/api/auth/register", novo("Dra.Ana@CLINICA.com"));
  check("domínio convidado (@clinica.com), sem diferenciar maiúsculas (201)", r.status === 201, JSON.stringify(r));
  setEnv({ NODE_ENV: "development" });
  r = await call("POST", "/api/auth/register", novo("dev@local.com"));
  check("desenvolvimento: cadastro livre (201)", r.status === 201, JSON.stringify(r));

  console.log("── Login sem senha (o ataque) ──");
  setEnv({ NODE_ENV: "production" });
  r = await call("POST", "/api/auth/verify-otp", { email: "medico@ok.com", otp: "123456" });
  check("conta NOVA (não verificada) conclui a verificação (200 + token)", r.status === 200 && !!r.json.token, JSON.stringify(r));
  const donoToken = r.json.token;
  r = await call("POST", "/api/auth/verify-otp", { email: "medico@ok.com", otp: "123456" });
  check("ATAQUE: conta JÁ verificada + código 123456, sem senha → NÃO entrega token (409)", r.status === 409 && r.json.code === "ALREADY_VERIFIED" && !r.json.token, JSON.stringify(r));
  r = await call("POST", "/api/auth/verify-otp", { email: "thiago@ecohealth.com", otp: "123456" });
  check("e-mail que não existe → sem token", !r.json.token, JSON.stringify(r));

  console.log("── Login ──");
  r = await call("POST", "/api/auth/login", { email: "dev@local.com", senha: "Senha@123" });
  check("conta NÃO verificada não consegue entrar (403 NOT_VERIFIED)", r.status === 403 && r.json.code === "NOT_VERIFIED" && !r.json.token, JSON.stringify(r));
  r = await call("POST", "/api/auth/login", { email: "medico@ok.com", senha: "Senha@123" });
  check("conta verificada + senha correta entra (200 + token)", r.status === 200 && !!r.json.token, JSON.stringify(r));
  r = await call("POST", "/api/auth/login", { email: "medico@ok.com", senha: "errada!" });
  check("senha errada é recusada (401)", r.status === 401 && !r.json.token, JSON.stringify(r));

  console.log("── Cobrança (webhook sem assinatura) ──");
  const evento = { type: "checkout.session.completed", data: { userId: "u1" } };
  r = await call("POST", "/api/billing/webhook", evento);
  check("produção: webhook desativado (501) — ninguém ativa Pro de graça", r.status === 501, JSON.stringify(r));
  check("plano do usuário NÃO foi alterado", users.every((u) => u.plan !== "pro"));
  setEnv({ NODE_ENV: "development" });
  r = await call("POST", "/api/billing/webhook", evento);
  check("desenvolvimento: webhook segue funcionando (200)", r.status === 200, JSON.stringify(r));

  console.log("── Status manual ──");
  setEnv({ NODE_ENV: "production" });
  r = await call("PATCH", "/api/consultations/abc/status", { status: "SIGNED" }, donoToken);
  check("não dá para marcar consulta como ASSINADA manualmente (400)", r.status === 400, JSON.stringify(r));
  r = await call("PATCH", "/api/consultations/abc/status", { status: "COMPLETED" }, donoToken);
  check("status comum continua aceito (chega à consulta → 404)", r.status === 404, JSON.stringify(r));
  r = await call("PATCH", "/api/consultations/abc/status", { status: "COMPLETED" });
  check("sem token: 401", r.status === 401, JSON.stringify(r));

  console.log("── Garantias estáticas (infra) ──");
  const idx = fs.readFileSync(SRC + "/index.ts", "utf8");
  check("trust proxy ligado (limites e IP por usuário, não do proxy)", /app\.set\("trust proxy", 1\)/.test(idx));
  check("documentação da API fechada em produção", /NODE_ENV"\] !== "production" \|\| process\.env\["ENABLE_DOCS"\]/.test(idx));
  const srcs = ["routes/auth.ts", "routes/consultations.ts", "routes/patients.ts"].map((f) => fs.readFileSync(SRC + "/" + f, "utf8")).join("\n");
  check("IP vem do Express (req.ip), não de cabeçalho forjável", !/x-forwarded-for/i.test(srcs));

  server.close();
  console.log(failed ? `\n${failed} FALHA(S)` : "\nTODOS OS TESTES PASSARAM");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("ERRO NO TESTE:", e); process.exit(2); });
