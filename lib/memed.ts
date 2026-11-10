/**
 * Carregamento do módulo de prescrição Memed no frontend.
 *
 * Segue as "Boas Práticas de Integração" da Memed:
 *  - script injetado UMA vez por sessão, com id fixo e guarda getElementById;
 *  - listeners (prescricaoImpressa / prescricaoExcluida) registrados uma única vez, dentro de core:moduleInit;
 *  - setWorkplace no core:moduleInit; abertura via await setPaciente + await module.show() no clique,
 *    sem reinjetar o script (singleton — esta página é uma SPA).
 *
 * As chaves da Memed NUNCA chegam aqui: o frontend recebe apenas o token do prescritor via backend.
 */

export const MEMED_SCRIPT_ID = "memed-prescricao-script";
export const PRESCRIPTION_MODULE = "plataforma.prescricao";

export interface MemedWorkplace {
  id: string;
  nome: string;
  endereco: string;
  telefone: string;
  cidade: string;
  uf: string;
}

export interface MemedPaciente {
  idExterno: string;
  nome: string;
  sexo?: string;
  cpf?: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;
}

interface MemedHandlers {
  onPrinted: (data: unknown) => void;
  onDeleted: (data: unknown) => void;
  onHide: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type MdEventApi = { event: { add: (name: string, cb: (...args: any[]) => unknown) => void } };
declare global {
  interface Window {
    MdSinapsePrescricao?: MdEventApi;
    MdHub?: MdEventApi & {
      command: { send: (module: string, command: string, data?: unknown) => Promise<unknown> };
      module: { show: (module: string) => Promise<unknown> };
    };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Estado do singleton (vive enquanto a aba estiver aberta)
let handlers: MemedHandlers | null = null;
let ready: Promise<void> | null = null;
let loadedForUser: string | null = null;
let listenersRegistered = false;

/** A página ativa (consulta aberta) define quem trata os eventos da Memed. */
export function setMemedHandlers(h: MemedHandlers | null): void {
  handlers = h;
}

function registerListenersOnce(): void {
  if (listenersRegistered || !window.MdHub) return;
  listenersRegistered = true;
  window.MdHub.event.add("prescricaoImpressa", (data: unknown) => handlers?.onPrinted(data));
  window.MdHub.event.add("prescricaoExcluida", (data: unknown) => handlers?.onDeleted(data));
}

/**
 * Injeta o script (uma vez) e resolve quando o módulo de prescrição estiver pronto (core:moduleInit).
 * Chamadas seguintes reaproveitam a mesma promessa — nunca reinjetam o script.
 */
export function loadMemed(params: {
  token: string;
  scriptUrl: string;
  userId: string;
  workplace: MemedWorkplace | null;
}): Promise<void> {
  // Outro médico entrou na mesma aba: o script carregado tem o token antigo → recarrega a página.
  if (loadedForUser && loadedForUser !== params.userId) {
    window.location.reload();
    return new Promise(() => {});
  }
  if (ready) return ready;

  ready = new Promise<void>((resolve, reject) => {
    if (document.getElementById(MEMED_SCRIPT_ID)) {
      // Já injetado (ex.: recarga a quente em desenvolvimento) — não injeta de novo.
      if (window.MdHub) {
        registerListenersOnce();
        resolve();
      } else {
        reject(new Error("Script Memed presente, mas módulo indisponível"));
      }
      return;
    }

    const timeout = window.setTimeout(() => reject(new Error("Tempo esgotado ao carregar a Memed")), 30_000);

    const script = document.createElement("script");
    script.id = MEMED_SCRIPT_ID;
    script.type = "text/javascript";
    script.src = params.scriptUrl;
    script.setAttribute("data-token", params.token);

    script.addEventListener("load", () => {
      const sinapse = window.MdSinapsePrescricao;
      if (!sinapse) {
        window.clearTimeout(timeout);
        reject(new Error("Módulo Memed não encontrado"));
        return;
      }
      sinapse.event.add("core:moduleInit", async (module: { name?: string }) => {
        if (module?.name !== PRESCRIPTION_MODULE) return;
        registerListenersOnce();
        if (params.workplace && window.MdHub) {
          try {
            await window.MdHub.command.send(PRESCRIPTION_MODULE, "setWorkplace", params.workplace);
          } catch (err) {
            console.warn("[Memed] setWorkplace falhou", err);
          }
        }
        window.clearTimeout(timeout);
        resolve();
      });
      sinapse.event.add("core:moduleHide", (module: { moduleName?: string; name?: string }) => {
        const name = module?.moduleName ?? module?.name;
        if (name === PRESCRIPTION_MODULE) handlers?.onHide();
      });
    });

    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Falha ao carregar o script da Memed"));
    });

    document.head.appendChild(script);
    loadedForUser = params.userId;
  }).catch((err) => {
    // Falha: permite nova tentativa (remove o script com erro para não bloquear a guarda)
    ready = null;
    loadedForUser = null;
    document.getElementById(MEMED_SCRIPT_ID)?.remove();
    throw err;
  });

  return ready;
}

/** Abre o módulo para o paciente informado (troca de paciente = apenas setPaciente). */
export async function openPrescription(paciente: MemedPaciente): Promise<void> {
  const hub = window.MdHub;
  if (!hub) throw new Error("Memed não carregada");
  await hub.command.send(PRESCRIPTION_MODULE, "setPaciente", paciente);
  await hub.module.show(PRESCRIPTION_MODULE);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Extrai o id da prescrição do payload dos eventos (aceita os formatos { prescricao: { id } } e { id }). */
export function extractPrescriptionId(data: unknown): string | null {
  const d = data as any;
  const id = d?.prescricao?.id ?? d?.id ?? d?.data?.id ?? (typeof d === "string" || typeof d === "number" ? d : null);
  return id === null || id === undefined || id === "" ? null : String(id);
}

export function extractItemsCount(data: unknown): number | undefined {
  const d = data as any;
  const meds = d?.prescricao?.medicamentos ?? d?.medicamentos;
  return Array.isArray(meds) ? meds.length : undefined;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
