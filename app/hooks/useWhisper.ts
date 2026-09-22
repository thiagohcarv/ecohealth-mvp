"use client";

import { useCallback, useState } from "react";
import { getAiModel } from "@/lib/preferences";

export type WhisperStatus = "idle" | "uploading" | "done" | "error";

export interface UseWhisperReturn {
  status: WhisperStatus;
  transcription: string | null;
  duration: number | null;
  error: string | null;
  uploadAudio: (blob: Blob, consultationId: string) => Promise<string | null>;
  reset: () => void;
}

interface TranscribeResponse {
  success: boolean;
  transcription: string;
  duration: number;
  error?: string;
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
const MAX_RETRIES = 2;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("eco_token");
}

export function useWhisper(): UseWhisperReturn {
  const [status, setStatus] = useState<WhisperStatus>("idle");
  const [transcription, setTranscription] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadAudio = useCallback(async (blob: Blob, consultationId: string): Promise<string | null> => {
    setStatus("uploading");
    setError(null);

    let lastError = "Falha ao enviar áudio";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const formData = new FormData();
        formData.append("audioFile", blob, "gravacao.webm");

        const headers: Record<string, string> = { "x-ai-model": getAiModel() };
        const token = getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/consultations/${consultationId}/transcribe`, {
          method: "PATCH",
          headers,
          body: formData,
        });

        const json = (await res.json()) as TranscribeResponse;

        if (!res.ok) {
          lastError = json.error ?? "Erro na transcrição";
          // Não tentar novamente em erros 4xx
          if (res.status < 500) break;
          continue;
        }

        setTranscription(json.transcription);
        setDuration(json.duration);
        setStatus("done");

        // Persiste localmente
        localStorage.setItem(`eco_transcription_${consultationId}`, json.transcription);

        return json.transcription;
      } catch {
        lastError = "Sem conexão com o servidor";
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    setError(lastError);
    setStatus("error");
    return null;
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setTranscription(null);
    setDuration(null);
    setError(null);
  }, []);

  return { status, transcription, duration, error, uploadAudio, reset };
}
