"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { SignButton, SignedBadge } from "@/components/ui/SignButton";
import { api } from "@/lib/api";

type SoapKey = "subjective" | "objective" | "assessment" | "plan";

interface SoapData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Codes: string[];
  confidence: number | null;
  model: string;
}

interface ConsultationDetail {
  id: string;
  date: string;
  status: string;
  chiefComplaint: string | null;
  signedAt: string | null;
  patient: { id: string; name: string; dateOfBirth: string | null };
  soapNote: (SoapData & { id: string }) | null;
  audioRecording: { durationSec: number | null } | null;
}

interface ConsultationDetailResponse {
  success: boolean;
  consultation: ConsultationDetail;
}

const SECTIONS: {
  key: SoapKey;
  label: string;
  abbr: string;
  accent: string;
  bg: string;
  border: string;
}[] = [
  { key: "subjective", label: "Subjetivo",  abbr: "S", accent: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-100"   },
  { key: "objective",  label: "Objetivo",   abbr: "O", accent: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
  { key: "assessment", label: "Avaliação",  abbr: "A", accent: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-100"  },
  { key: "plan",       label: "Plano",      abbr: "P", accent: "text-green-600",  bg: "bg-green-50",  border: "border-green-100"  },
];

export default function ConsultaDetailPage({ params }: { params: { id: string } }) {
  const [activeKey, setActiveKey] = useState<SoapKey>("subjective");
  const [soap, setSoap] = useState<SoapData | null>(null);
  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [signedAt, setSignedAt] = useState<Date | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soapRef = useRef<SoapData | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    api.get<ConsultationDetailResponse>(`/api/consultations/${params.id}`).then((res) => {
      if ("error" in res) {
        setErroCarregar(res.error ?? "Consulta não encontrada.");
      } else {
        const c = res.data.consultation;
        setConsultation(c);
        if (c.soapNote) {
          const s: SoapData = {
            subjective: c.soapNote.subjective,
            objective: c.soapNote.objective,
            assessment: c.soapNote.assessment,
            plan: c.soapNote.plan,
            icd10Codes: c.soapNote.icd10Codes,
            confidence: c.soapNote.confidence,
            model: c.soapNote.model,
          };
          setSoap(s);
          soapRef.current = s;
        }
        if (c.signedAt) setSignedAt(new Date(c.signedAt));
      }
      setCarregando(false);
      isInitialLoad.current = false;
    });
  }, [params.id]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [activeKey, soap]);

  const handleChange = useCallback((value: string) => {
    if (isInitialLoad.current) return;
    setSaveStatus("unsaved");
    setSoap((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [activeKey]: value };
      soapRef.current = next;
      return next;
    });

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const data = soapRef.current;
      if (!data) return;
      setSaveStatus("saving");
      const res = await api.patch(`/api/consultations/${params.id}/soap`, {
        subjective: data.subjective,
        objective: data.objective,
        assessment: data.assessment,
        plan: data.plan,
      });
      setSaveStatus("error" in res ? "unsaved" : "saved");
    }, 2000);
  }, [activeKey, params.id]);

  const active = SECTIONS.find((s) => s.key === activeKey) ?? SECTIONS[0]!;
  const confPct = soap?.confidence != null ? Math.round(soap.confidence * 100) : null;
  const confColor =
    confPct == null ? "text-secondary-400"
    : confPct >= 85  ? "text-green-600"
    : confPct >= 65  ? "text-amber-600"
    : "text-red-500";

  const patientName = consultation?.patient.name ?? "—";
  const dateLabel = consultation
    ? new Date(consultation.date).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";
  const durationLabel = consultation?.audioRecording?.durationSec
    ? `${Math.round(consultation.audioRecording.durationSec / 60)} min`
    : null;

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen pb-10">
        {/* Status bar */}
        <div className="h-[47px] flex items-center px-6">
          <span className="text-[16px] font-medium font-inter text-neutral-black" suppressHydrationWarning>
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pb-4">
          <Link href="/historico" aria-label="Voltar" className="mt-0.5 text-secondary-500 shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-inter font-bold text-xl text-secondary-500 truncate">{patientName}</h1>
            <p className="text-xs text-secondary-400">
              {dateLabel}{durationLabel ? ` · ${durationLabel}` : ""}
            </p>
          </div>
          {/* Auto-save indicator */}
          <div className="flex items-center gap-1 mt-1 shrink-0">
            {saveStatus === "unsaved" && <div className="w-2 h-2 rounded-full bg-amber-400" />}
            {saveStatus === "saving" && (
              <svg className="animate-spin w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {saveStatus === "saved" && soap && (
              <svg className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            <span className={`text-[10px] font-medium ${
              saveStatus === "saved" ? "text-green-600"
              : saveStatus === "saving" ? "text-primary"
              : "text-amber-500"
            }`}>
              {saveStatus === "saved" ? "Salvo" : saveStatus === "saving" ? "Salvando" : "Editando"}
            </span>
          </div>
        </div>

        {/* Loading */}
        {carregando && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
            <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-secondary-400">Carregando consulta...</p>
          </div>
        )}

        {/* Erro */}
        {!carregando && erroCarregar && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 text-center">
            {erroCarregar}
          </div>
        )}

        {/* Conteúdo */}
        {!carregando && !erroCarregar && consultation && (
          <>
            {/* Meta card */}
            <div className="mx-6 mb-5 bg-primary-50 border border-primary-100 rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-secondary-400 mb-0.5">Queixa principal</p>
                  <p className="text-sm font-semibold text-secondary-500">
                    {consultation.chiefComplaint ?? "Não informada"}
                  </p>
                </div>
                {confPct != null && (
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-secondary-400 mb-0.5">Confiança</p>
                    <p className={`text-lg font-bold ${confColor}`}>{confPct}%</p>
                  </div>
                )}
              </div>
              {soap && soap.icd10Codes.length > 0 && (
                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-primary-100 flex-wrap">
                  {soap.icd10Codes.map((c) => (
                    <span key={c} className="text-[11px] font-bold bg-primary text-white rounded-full px-2.5 py-0.5">
                      {c}
                    </span>
                  ))}
                  <span className="text-[10px] text-secondary-300 ml-auto">{soap.model}</span>
                </div>
              )}
            </div>

            {/* SOAP não disponível */}
            {!soap && (
              <div className="mx-6 mb-5 bg-secondary-100 rounded-2xl px-4 py-6 text-center">
                <p className="text-sm text-secondary-400">Nota SOAP não gerada ainda.</p>
                <p className="text-xs text-secondary-300 mt-1">
                  Status: <span className="font-medium">{consultation.status}</span>
                </p>
              </div>
            )}

            {/* Editor SOAP */}
            {soap && (
              <>
                {/* Tabs S / O / A / P */}
                <div className="flex gap-1.5 px-6 mb-4">
                  {SECTIONS.map((s) => {
                    const isActive = activeKey === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setActiveKey(s.key)}
                        className={`flex-1 rounded-xl py-2.5 transition-all ${isActive ? "bg-primary shadow-lg" : "bg-secondary-100"}`}
                      >
                        <p className={`text-sm font-bold leading-none ${isActive ? "text-white" : "text-secondary-400"}`}>
                          {s.abbr}
                        </p>
                        {confPct != null && (
                          <p className={`text-[9px] mt-0.5 font-medium ${isActive ? "text-white/70" : "text-secondary-300"}`}>
                            {confPct}%
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Label + confiança */}
                <div className="flex items-center justify-between px-6 mb-2">
                  <p className={`text-xs font-bold ${active.accent}`}>{active.label}</p>
                  {confPct != null && (
                    <span className={`text-[10px] font-medium ${confColor}`}>{confPct}% confiança</span>
                  )}
                </div>

                {/* Textarea */}
                <div className={`mx-6 border rounded-2xl p-4 ${active.bg} ${active.border} animate-fade-in`}>
                  <textarea
                    ref={textareaRef}
                    value={soap[activeKey]}
                    onChange={(e) => handleChange(e.target.value)}
                    className="w-full bg-transparent text-sm font-inter text-secondary-500 outline-none resize-none leading-relaxed"
                    style={{ minHeight: "120px" }}
                  />
                </div>

                <p className="text-center text-[10px] text-secondary-300 mt-2 mb-6 px-6">
                  Toque no texto para editar · Salvo automaticamente em 2s
                </p>
              </>
            )}

            {/* Status badge */}
            {signedAt ? (
              <div className="px-6 mb-3">
                <SignedBadge signedAt={signedAt} />
              </div>
            ) : (
              <div className="px-6 mb-3">
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 w-fit">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] font-semibold text-amber-700">Rascunho</span>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="px-6 flex flex-col gap-2.5 pb-6">
              {soap && (
                <SignButton
                  consultationId={params.id}
                  onSigned={(dt) => setSignedAt(dt)}
                />
              )}
              <div className="flex gap-2">
                <Link
                  href="/nova-consulta"
                  className="flex-1 h-10 rounded-2xl bg-secondary-100 text-secondary-500 text-sm font-medium font-inter flex items-center justify-center"
                >
                  Nova consulta
                </Link>
                <button className="flex-1 h-10 rounded-2xl btn-primary-gradient btn-primary-shadow border border-white text-white text-sm font-medium font-inter flex items-center justify-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Exportar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </MobileScreen>
  );
}
