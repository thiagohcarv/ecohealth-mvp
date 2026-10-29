/**
 * Controle do modo simulado (mock) da IA.
 *
 * Em PRODUÇÃO o sistema NUNCA devolve transcrição/nota inventada como se fosse real:
 * sem chave da OpenAI ou sem cota, a API responde com erro claro.
 * Para uma demonstração com dados fictícios, defina ALLOW_AI_MOCK=true no servidor.
 * Fora de produção (desenvolvimento), o mock continua disponível.
 */
export function aiMockAllowed(): boolean {
  return process.env["NODE_ENV"] !== "production" || process.env["ALLOW_AI_MOCK"] === "true";
}

/** A IA não pode ser usada porque o servidor não está configurado (ex.: sem OPENAI_API_KEY). */
export class AiConfigError extends Error {
  constructor(message = "IA indisponível: chave da OpenAI não configurada no servidor.") {
    super(message);
    this.name = "AiConfigError";
  }
}
