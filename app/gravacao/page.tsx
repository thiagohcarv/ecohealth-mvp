"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { BottomNav } from "@/components/ui/BottomNav";
import { AudioRecorder } from "./components/AudioRecorder";
import { SoapNote } from "./components/SoapNote";
import { TranscriptionEditor } from "./components/TranscriptionEditor";
import { purgeClinicalCache } from "@/lib/privacy";
import { useSoapGenerator, type SoapNoteData } from "@/app/hooks/useSoapGenerator";
import { api } from "@/lib/api";

interface ConsultationCreateResponse {
  success: boolean;
  consultation: { id: string };
}

interface ConsultationDetailResponse {
  success: boolean;
  consultation: {
    audioRecording: { transcription: string | null; durationSec: number | null } | null;
    soapNote: {
      id: string;
      subjective: string | null;
      objective: string | null;
      assessment: string | null;
      plan: string | null;
      icd10Codes: string[] | null;
      confidence: number | null;
      model: string;
    } | null;
  };
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Restaura transcrição e nota SOAP pelo SERVIDOR (nada de texto clínico no navegador)
  useEffect(() => {
    purgeClinicalCache();
    if (!consultationId) return;
    let cancelled = false;
    api.get<ConsultationDetailResponse>(`/api/consultations/${consultationId}`).then((res) => {
      if (cancelled || "error" in res) return;
      const c = res.data.consultation;
      if (c.audioRecording?.transcription) setTranscription(c.audioRecording.transcription);
      if (c.audioRecording?.durationSec) setDuration(c.audioRecording.durationSec);
      if (c.soapNote) {
        soap.setSoapNote({
          id: c.soapNote.id,
          subjective: c.soapNote.subjective ?? "",
          objective: c.soapNote.objective ?? "",
          assessment: c.soapNote.assessment ?? "",
          plan: c.soapNote.plan ?? "",
          icd10Codes: c.soapNote.icd10Codes ?? [],
          confidence: c.soapNote.confidence ?? null,
          model: c.soapNote.model,
        });
        setStage("soap-done");
      }
    });
    return () => { cancelled = true; };
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
    if (!consultationId || !transcription) return;
    if (soap.soapNote && !window.confirm("Gerar novamente substitui a nota atual, incluindo as suas edições. Continuar?")) {
      return;
    }
    setSaveError(null);
    // A nota é gerada a partir da transcrição SALVA no servidor: garante que o texto corrigido está lá
    const saved = await api.patch(`/api/consultations/${consultationId}/transcription`, { transcription });
    if ("error" in saved) {
      setSaveError(saved.error ?? "Não foi possível salvar a transcrição. Tente novamente.");
      return;
    }
    setStage("soap-loading");
    const result = await soap.generateSoap(consultationId);
    if (result) setStage("soap-done");
    else setStage("recording"); // volta se falhar
  }, [consultationId, soap, transcription]);

  const handleSoapChange = useCallback((updated: SoapNoteData) => {
    soap.setSoapNote(updated);
  }, [soap]);

  const handleSalvar = useCallback(async () => {
    setSaveError(null);
    // Garante que as edições da nota estão no banco antes de abrir o histórico
    if (consultationId && soap.soapNote) {
      setSaving(true);
      const n = soap.soapNote;
      const res = await api.patch(`/api/consultations/${consultationId}/soap`, {
        subjective: n.subjective,
        objective: n.objective,
        assessment: n.assessment,
        plan: n.plan,
        icd10Codes: n.icd10Codes,
      });
      setSaving(false);
      if ("error" in res) {
        setSaveError(res.error ?? "Não foi possível salvar a nota. Tente novamente.");
        return;
      }
    }
    router.push(consultationId ? `/historico/${consultationId}` : "/historico");
  }, [router, consultationId, soap.soapNote]);

  const handleNovaConsulta = useCallback(() => {
    router.push("/nova-consulta");
  }, [router]);

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

          {/* Transcrição editável (antes de gerar a nota) */}
          {stage === "recording" && consultationId && transcription !== null && (
            <div className="w-full px-6 mb-2">
              <TranscriptionEditor consultationId={consultationId} value={transcription} onChange={setTranscription} />
            </div>
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
              {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}
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
              {saveError && <p className="text-xs text-red-500 text-center">{saveError}</p>}
              <button
                onClick={handleSalvar}
                disabled={saving}
                className="w-full h-12 rounded-3xl btn-primary-gradient btn-primary-shadow border border-white text-white text-sm font-medium font-inter flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {saving ? "Salvando..." : "Salvar consulta"}
              </button>
              <button
                onClick={() => setStage("recording")}
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
