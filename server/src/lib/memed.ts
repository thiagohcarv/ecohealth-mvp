/**
 * Integração com a prescrição digital Memed (backend).
 *
 * Segue "Primeiros passos" e "Boas Práticas de Integração" da Memed:
 *  - API_KEY / SECRET_KEY existem SOMENTE aqui (variáveis de ambiente), nunca no frontend;
 *  - o token do prescritor é recuperado a cada atendimento (não é estático);
 *  - se o prescritor ainda não existe na Memed, é cadastrado com os dados obrigatórios (RDC 1000/25).
 *
 * Sem MEMED_API_KEY/MEMED_SECRET_KEY a integração fica DESLIGADA e o MVP funciona como antes.
 */

import { isValidCpf, nomeSemTitulo, onlyDigits } from "./validators";

export { onlyDigits };

// Homologação (padrão). Em produção, troque as URLs e as chaves pelas variáveis de ambiente.
const DEFAULT_API_URL = "https://integrations.api.memed.com.br/v1";
const DEFAULT_SCRIPT_URL =
  "https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js";

export interface MemedConfig {
  apiUrl: string;
  scriptUrl: string;
  apiKey: string;
  secretKey: string;
  /** Prefixo do parceiro para ids externos (evita colisão no ambiente de homologação). */
  prefix: string;
}

export function getMemedConfig(): MemedConfig | null {
  const apiKey = process.env["MEMED_API_KEY"]?.trim();
  const secretKey = process.env["MEMED_SECRET_KEY"]?.trim();
  if (!apiKey || !secretKey) return null;
  return {
    apiKey,
    secretKey,
    apiUrl: (process.env["MEMED_API_URL"]?.trim() || DEFAULT_API_URL).replace(/\/+$/, ""),
    scriptUrl: process.env["MEMED_SCRIPT_URL"]?.trim() || DEFAULT_SCRIPT_URL,
    prefix: process.env["MEMED_EXTERNAL_PREFIX"]?.trim() || "ecohealth",
  };
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

/** Date -> "dd/mm/aaaa" (usa UTC: datas de nascimento são gravadas sem horário). */
export function toBrDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** "SP-123456" -> { state: "SP", number: "123456" } */
export function parseCrm(crm: string): { state: string; number: string } | null {
  const m = /^([A-Za-z]{2})-?(.+)$/.exec(crm.trim());
  if (!m) return null;
  const number = onlyDigits(m[2]);
  if (!number) return null;
  return { state: m[1]!.toUpperCase(), number };
}

// ─── Prescritor ───────────────────────────────────────────────────────────────

export interface PrescriberUser {
  id: string;
  name: string;
  email: string;
  crm: string;
  cpf: string | null;
  phone: string | null;
  birthDate: Date | null;
  specialty: string | null;
  city: string | null;
}

/** Campos obrigatórios que faltam no cadastro do médico para emitir receitas. */
export function missingPrescriberFields(u: PrescriberUser): string[] {
  const missing: string[] = [];
  if (!u.cpf || !isValidCpf(u.cpf)) missing.push("cpf");
  if (!u.birthDate) missing.push("birthDate");
  if (!parseCrm(u.crm)) missing.push("crm");
  if (nomeSemTitulo(u.name).split(" ").length < 2) missing.push("sobrenome");
  return missing;
}

export class MemedError extends Error {
  constructor(message: string, public status: number, public detail?: string) {
    super(message);
  }
}

function qs(cfg: MemedConfig): string {
  return `api-key=${encodeURIComponent(cfg.apiKey)}&secret-key=${encodeURIComponent(cfg.secretKey)}`;
}

const HEADERS = {
  Accept: "application/vnd.api+json",
  "Content-Type": "application/json",
  "Cache-Control": "no-cache",
};

async function memedFetch(url: string, init: RequestInit = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(url, { ...init, headers: HEADERS, signal: AbortSignal.timeout(15_000) });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* corpo vazio */
  }
  return { status: res.status, json };
}

function firstErrorDetail(json: any): string | undefined {
  const e = json?.errors?.[0];
  return e?.detail ?? e?.title ?? undefined;
}

/** Busca um item de lista (especialidades/cidades) pelo nome — melhor esforço; retorna null se não achar. */
async function lookupId(cfg: MemedConfig, resource: "especialidades" | "cidades", name: string | null): Promise<number | null> {
  if (!name?.trim()) return null;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  try {
    const filter = resource === "cidades" ? `&filter%5Bq%5D=${encodeURIComponent(name.trim())}` : "";
    const { status, json } = await memedFetch(`${cfg.apiUrl}/${resource}?${qs(cfg)}${filter}`);
    if (status !== 200 || !Array.isArray(json?.data)) return null;
    const target = norm(name);
    const hit = json.data.find((it: any) => norm(String(it?.attributes?.nome ?? "")) === target);
    const id = Number(hit?.id);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export function externalIdFor(cfg: MemedConfig, userId: string): string {
  return `${cfg.prefix}-${userId}`;
}

/**
 * Retorna o token atual do prescritor. Consulta pelo external_id e, se não existir,
 * cadastra o prescritor com os dados do EcoHealth.
 */
export async function getPrescriberToken(cfg: MemedConfig, user: PrescriberUser): Promise<string> {
  const externalId = externalIdFor(cfg, user.id);

  const found = await memedFetch(`${cfg.apiUrl}/sinapse-prescricao/usuarios/${encodeURIComponent(externalId)}?${qs(cfg)}`);
  const foundToken = found.json?.data?.attributes?.token;
  if (found.status === 200 && foundToken) return String(foundToken);
  if (found.status !== 404 && found.status !== 200) {
    throw new MemedError("Falha ao consultar o prescritor na Memed", found.status, firstErrorDetail(found.json));
  }

  const crm = parseCrm(user.crm)!;
  // Nome civil, sem "Dr./Dra." (contas antigas podem ter o título salvo no nome)
  const [nome, ...resto] = nomeSemTitulo(user.name).split(" ");
  const [especialidadeId, cidadeId] = await Promise.all([
    lookupId(cfg, "especialidades", user.specialty),
    lookupId(cfg, "cidades", user.city),
  ]);

  const relationships: Record<string, unknown> = {};
  if (cidadeId) relationships["cidade"] = { data: { type: "cidades", id: cidadeId } };
  if (especialidadeId) relationships["especialidade"] = { data: { type: "especialidades", id: especialidadeId } };

  const body = {
    data: {
      type: "usuarios",
      attributes: {
        external_id: externalId,
        nome,
        sobrenome: resto.join(" "),
        cpf: onlyDigits(user.cpf),
        board: { board_code: "CRM", board_number: crm.number, board_state: crm.state },
        email: user.email,
        ...(user.phone ? { telefone: onlyDigits(user.phone) } : {}),
        data_nascimento: toBrDate(user.birthDate),
      },
      ...(Object.keys(relationships).length ? { relationships } : {}),
    },
  };

  const created = await memedFetch(`${cfg.apiUrl}/sinapse-prescricao/usuarios?${qs(cfg)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const createdToken = created.json?.data?.attributes?.token;
  if (created.status >= 200 && created.status < 300 && createdToken) return String(createdToken);

  throw new MemedError("Não foi possível cadastrar o prescritor na Memed", created.status, firstErrorDetail(created.json));
}
