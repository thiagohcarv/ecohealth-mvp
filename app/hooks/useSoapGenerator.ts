"use client";

import { useCallback, useState } from "react";
import { getAiModel } from "@/lib/preferences";

export type SoapGenStatus = "idle" | "loading" | "done" | "error";

export interface SoapNoteData {
  id: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Codes: string[];
  confidence: number | null;
  model: string;
}

export interface UseSoapGeneratorReturn {
  status: SoapGenStatus;
  soapNote: SoapNoteData | null;
  error: string | null;
  generateSoap: (consultationId: string) => Promise<SoapNoteData | null>;
  setSoapNote: (note: SoapNoteData) => void;
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("eco_token");
}

export function useSoapGenerator(): UseSoapGeneratorReturn {
  const [status, setStatus] = useState<SoapGenStatus>("idle");
  const [soapNote, setSoapNote] = useState<SoapNoteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSoap = useCallback(async (consultationId: string): Promise<SoapNoteData | null> => {
    setStatus("loading");
    setError(null);

    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-ai-model": getAiModel(),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_URL}/api/consultations/${consultationId}/generate-soap`, {
        method: "POST",
        headers,
      });

      const json = (await res.json()) as { success?: boolean; soapNote?: SoapNoteData; error?: string };

      if (!res.ok || !json.soapNote) {
        setError(json.error ?? "Erro ao gerar SOAP");
        setStatus("error");
        return null;
      }

      setSoapNote(json.soapNote);
      setStatus("done");

      localStorage.setItem(`eco_soap_${consultationId}`, JSON.stringify(json.soapNote));
      return json.soapNote;
    } catch {
      setError("Erro de rede ao gerar SOAP");
      setStatus("error");
      return null;
    }
  }, []);

  return { status, soapNote, error, generateSoap, setSoapNote };
}
