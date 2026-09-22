import type { AiModel, Lang } from "./preferences";

const T = {
  "pt-BR": {
    settings: "Configurações",
    sAccount: "Conta",
    sNotifications: "Notificações",
    sPreferences: "Preferências",
    sAbout: "Sobre",
    sSession: "Sessão",
    personalData: "Dados pessoais",
    email: "E-mail",
    changePassword: "Alterar senha",
    newConsultation: "Nova consulta",
    newConsultationSub: "Aviso quando transcrição concluir",
    soapGenerated: "SOAP gerado",
    soapSub: "Aviso quando nota estiver pronta",
    weeklyEmail: "Resumo semanal por e-mail",
    language: "Idioma",
    aiModel: "Modelo de IA padrão",
    version: "Versão",
    terms: "Termos de uso",
    privacy: "Política de privacidade",
    logout: "Sair da conta",
  },
  en: {
    settings: "Settings",
    sAccount: "Account",
    sNotifications: "Notifications",
    sPreferences: "Preferences",
    sAbout: "About",
    sSession: "Session",
    personalData: "Personal data",
    email: "E-mail",
    changePassword: "Change password",
    newConsultation: "New consultation",
    newConsultationSub: "Alert when transcription completes",
    soapGenerated: "SOAP ready",
    soapSub: "Alert when note is ready",
    weeklyEmail: "Weekly email summary",
    language: "Language",
    aiModel: "Default AI model",
    version: "Version",
    terms: "Terms of use",
    privacy: "Privacy policy",
    logout: "Sign out",
  },
} as const;

export type TKey = keyof typeof T["pt-BR"];

export function t(lang: Lang, key: TKey): string {
  return T[lang][key];
}

export const AI_MODEL_LABELS: Record<AiModel, { badge: string; sub: string }> = {
  "gpt-4o":            { badge: "GPT-4o",      sub: "OpenAI · Recomendado" },
  "claude-3-5-sonnet": { badge: "Claude 3.5",  sub: "Anthropic"            },
  "whisper-large":     { badge: "Whisper",      sub: "Transcrição local"    },
};
