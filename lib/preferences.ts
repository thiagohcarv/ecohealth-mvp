export type Lang = "pt-BR" | "en";
export type AiModel = "gpt-4o" | "claude-3-5-sonnet" | "whisper-large";

export interface Preferences {
  lang: Lang;
  aiModel: AiModel;
}

export const PREF_DEFAULTS: Preferences = {
  lang: "pt-BR",
  aiModel: "gpt-4o",
};

const KEY = "eco_preferences";

export function loadPrefs(): Preferences {
  if (typeof window === "undefined") return PREF_DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return PREF_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    return {
      lang: (parsed["lang"] as Lang | undefined) ?? PREF_DEFAULTS.lang,
      aiModel: (parsed["aiModel"] as AiModel | undefined) ?? PREF_DEFAULTS.aiModel,
    };
  } catch {
    return PREF_DEFAULTS;
  }
}

export function persistPrefs(prefs: Preferences): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function getAiModel(): AiModel {
  return loadPrefs().aiModel;
}
