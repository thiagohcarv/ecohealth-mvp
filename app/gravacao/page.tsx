"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { BottomNav } from "@/components/ui/BottomNav";
import { AudioRecorder } from "./components/AudioRecorder";
import { SoapNote } from "./components/SoapNote";
import { useSoapGenerator, type SoapNoteData } from "@/app/hooks/useSoapGenerator";
import { api } from "@/lib/api";

interface ConsultationCreateResponse {
  success: boolean;
  consultation: { id: string };
}

type PageStage = "recording" | "soap-loading" | "soap-done";

function GravacaoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const soap = useSoapGenerator();

  const [consultationId, setConsultationId] = useState<string | null>(searchParams.get("id"));
  const [transcription, setTranscription] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [preparing, setPreparing] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [stage, setStage] = useState<PageStage>("recording");

  // Restaura transcrição e SOAP do localStorage se já existirem
  useEffect(() => {
    if (!consultationId) return;
    const cachedTx = localStorage.getItem(`eco_transcription_${consultationId}`);
    if (cachedTx) setTranscription(cachedTx);

    const cachedSoap = localStorage.getItem(`eco_soap_${consultationId}`);
    if (cachedSoap) {
      try {
        soap.setSoapNote(JSON.parse(cachedSoap) as SoapNoteData);
        setStage("soap-done");
      } catch { /* ignora JSON inválido */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  // Cria consulta automaticamente se não houver ID na URL
  useEffect(() => {
    if (consultationId) return;
    setPreparing(true);
    api
      .post<ConsultationCreateResponse>("/api/consultations", { patientName: "Paciente" })
      .then((result) => {
        if ("error" in result) {
          setPrepError(result.error ?? "Erro ao criar consulta");
        } else {
          setConsultationId(result.data.consultation.id ?? null);
        }
      })
      .finally(() => setPreparing(false));
  }, [consultationId]);

  const handleTranscriptionComplete = useCallback((text: string, dur: number) => {
    setTranscription(text);
    setDuration(dur);
  }, []);

  const handleGerarSoap = useCallback(async () => {
    if (!consultationId) return;
    setStage("soap-loading");
    const result = await soap.generateSoap(consultationId);
    if (result) setStage("soap-done");
    else setStage("recording"); // volta se falhar
  }, [consultationId, soap]);

  const handleSoapChange = useCallback((updated: SoapNoteData) => {
    soap.setSoapNote(updated);
  }, [soap]);

  const handleSalvar = useCallback(() => {
    router.push(consultationId ? `/historico/${consultationId}` : "/historico");
  }, [router, consultationId]);

  const handleNovaConsulta = useCallback(() => {
    if (consultationId) {
      localStorage.removeItem(`eco_transcription_${consultationId}`);
      localStorage.removeItem(`eco_soap_${consultationId}`);
    }
    router.push("/nova-consulta");
  }, [router, consultationId]);

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen pb-36 lg:pb-0">
        {/* Status bar */}
        <div className="h-[47px] flex items-center justify-between px-6">
          <span className="text-[16px] font-medium font-inter text-neutral-black">
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button onClick={handleNovaConsulta} className="p-1 text-secondary-400" aria-label="Cancelar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Título dinâmico */}
        <div className="px-6 mb-2">
          <h1 className="font-inter font-bold text-xl text-secondary-500">
            {stage === "recording" ? "Gravação" : stage === "soap-loading" ? "Gerando SOAP..." : "Nota SOAP"}
          </h1>
          <p className="text-xs text-secondary-400">
            {stage === "recording" && !transcription && "Grave a consulta para transcrever"}
            {stage === "recording" && transcription && "Transcrição pronta — gere a nota SOAP"}
            {stage === "soap-loading" && "Estruturando consulta com IA..."}
            {stage === "soap-done" && "Revise e edite antes de salvar"}
          </p>
        </div>

        {/* Corpo */}
        <div className="flex flex-col items-center flex-1 px-0">
          {/* Preparando consulta */}
          {preparing && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-secondary-400">Preparando consulta...</p>
            </div>
          )}

          {prepError && (
            <div className="w-full px-6 mt-8">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 text-center">
                {prepError}
              </div>
            </div>
          )}

          {/* Gravador de áudio */}
          {!preparing && !prepError && consultationId && stage === "recording" && (
            <AudioRecorder
              consultationId={consultationId}
              onTranscriptionComplete={handleTranscriptionComplete}
            />
          )}

          {/* Loading SOAP */}
          {stage === "soap-loading" && (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6">
              <div className="w-20 h-20 rounded-full bg-primary-50 border-2 border-primary flex items-center justify-center">
                <svg className="animate-spin w-10 h-10 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-secondary-500">Gerando estrutura da consulta...</p>
                <p className="text-xs text-secondary-400 mt-1">GPT-4o está analisando a transcrição</p>
              </div>
              {/* Preview da transcrição enquanto carrega */}
              {transcription && (
                <div className="w-full bg-secondary-100 rounded-xl p-3 mt-2">
                  <p className="text-xs text-secondary-400 mb-1">Transcrição</p>
                  <p className="text-xs text-secondary-500 line-clamp-3">{transcription}</p>
                </div>
              )}
            </div>
          )}

          {/* Nota SOAP gerada */}
          {stage === "soap-done" && soap.soapNote && consultationId && (
            <div className="w-full px-6 mt-2">
              <SoapNote
                soapData={soap.soapNote}
                consultationId={consultationId}
                onChange={handleSoapChange}
              />
            </div>
          )}

          {/* Erro SOAP */}
          {soap.status === "error" && stage === "recording" && (
            <div className="w-full px-6 mt-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 text-center">
                {soap.error}
              </div>
            </div>
          )}
        </div>

        {/* Botões de ação no rodapé */}
        <div className="w-full px-[14px] flex flex-col gap-3 mt-4">
          {/* Após transcrição: botão Gerar SOAP */}
          {stage === "recording" && transcription && (
            <>
              {duration > 0 && (
                <p className="text-xs text-secondary-400 text-right -mb-1">
                  Duração: {Math.round(duration)}s
                </p>
              )}
              <button
                onClick={handleGerarSoap}
                className="w-full h-12 rounded-3xl btn-primary-gradient btn-primary-shadow border border-white text-white text-sm font-medium font-inter flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Gerar Nota SOAP com IA
              </button>
              <button
                onClick={handleNovaConsulta}
                className="w-full h-12 rounded-3xl border border-secondary-100 text-secondary-400 text-sm font-medium font-inter"
              >
                Nova consulta
              </button>
            </>
          )}

          {/* Após SOAP gerado: botões Salvar e Nova consulta */}
          {stage === "soap-done" && (
            <>
              <button
                onClick={handleSalvar}
                className="w-full h-12 rounded-3xl btn-primary-gradient btn-primary-shadow border border-white text-white text-sm font-medium font-inter flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Salvar consulta
              </button>
              <button
                onClick={() => {
                  setStage("recording");
                  setTranscription(null);
                  soap.setSoapNote(null as unknown as SoapNoteData);
                }}
                className="w-full h-10 rounded-3xl border border-secondary-100 text-secondary-400 text-sm font-medium font-inter"
              >
                ← Editar transcrição
              </button>
              <button
                onClick={handleNovaConsulta}
                className="w-full h-10 rounded-3xl text-secondary-300 text-sm font-inter"
              >
                Nova consulta
              </button>
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </MobileScreen>
  );
}

export default function GravacaoPage() {
  return (
    <Suspense>
      <GravacaoContent />
    </Suspense>
  );
}
