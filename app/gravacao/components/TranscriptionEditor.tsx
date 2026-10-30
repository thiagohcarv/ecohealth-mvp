"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface Props {
  consultationId: string;
  value: string;
  onChange: (text: string) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Transcrição editável: o médico corrige o texto (ex.: nomes de medicamentos) antes de gerar o SOAP. */
export function TranscriptionEditor({ consultationId, value, onChange }: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(value);
  const dirtyRef = useRef(false);

  // Texto novo vindo de fora (nova gravação) substitui o atual e descarta pendências antigas
  useEffect(() => {
    if (value !== latestRef.current) {
      latestRef.current = value;
      dirtyRef.current = false;
      setSaveState("idle");
    }
  }, [value]);

  const persist = useCallback(async () => {
    if (!dirtyRef.current) return;
    const text = latestRef.current;
    if (text.trim().length < 3) return;
    dirtyRef.current = false;
    setSaveState("saving");
    const res = await api.patch(`/api/consultations/${consultationId}/transcription`, { transcription: text });
    if ("error" in res) {
      dirtyRef.current = true;
      setSaveState("error");
    } else {
      setSaveState("saved");
    }
  }, [consultationId]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    latestRef.current = text;
    dirtyRef.current = true;
    setSaveState("idle");
    onChange(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void persist(); }, 1200);
  }

  // Ao sair da tela, grava o que ainda estiver pendente
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (dirtyRef.current && latestRef.current.trim().length >= 3) {
      void api.patch(`/api/consultations/${consultationId}/transcription`, { transcription: latestRef.current });
    }
  }, [consultationId]);

  return (
    <div className="w-full animate-fade-in">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-secondary-400">Transcrição — revise e corrija</span>
        <span className="text-xs">
          {saveState === "saving" && <span className="text-secondary-400">Salvando…</span>}
          {saveState === "saved" && <span className="text-green-600">Salvo</span>}
          {saveState === "error" && <span className="text-red-500">Não salvo — verifique a conexão</span>}
        </span>
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        rows={5}
        aria-label="Transcrição da consulta"
        className="w-full border border-secondary-100 rounded-2xl px-4 py-3 text-sm font-inter text-secondary-500 leading-relaxed outline-none resize-y focus:border-primary transition-colors"
      />
      <p className="text-[11px] text-secondary-400 mt-1.5 leading-snug">
        Confira nomes de medicamentos, doses e valores. A nota SOAP será gerada a partir deste texto.
      </p>
    </div>
  );
}
