/**
 * Texto clínico (transcrição e notas) vive SOMENTE no servidor, criptografado.
 * Versões antigas do app guardavam cópias em texto puro no navegador: esta função as remove.
 */
export function purgeClinicalCache(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("eco_transcription_") || key.startsWith("eco_soap_")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* localStorage indisponível */
  }
}
