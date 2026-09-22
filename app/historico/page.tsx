"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { BottomNav } from "@/components/ui/BottomNav";
import { api } from "@/lib/api";

type Status = "PENDING" | "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "SIGNED";

interface Consulta {
  id: string;
  paciente: string;
  queixa: string;
  cid?: string;
  data: string;   // "dd/MM/yyyy"
  hora: string;   // "HH:mm"
  status: Status;
  duracao?: string;
}

interface ApiConsultation {
  id: string;
  date: string;
  status: Status;
  chiefComplaint: string | null;
  patient: { id: string; name: string; cpf: string | null };
  soapNote: { id: string; assessment: string; icd10Codes: string[] } | null;
  audioRecording: { durationSec: number | null } | null;
}

interface ConsultationListResponse {
  success: boolean;
  consultations: ApiConsultation[];
  total: number;
}

const STATUS: Record<Status, { label: string; dot: string; text: string }> = {
  COMPLETED:  { label: "Concluída",   dot: "bg-green-500",  text: "text-green-700"  },
  SIGNED:     { label: "Assinada",    dot: "bg-green-600",  text: "text-green-800"  },
  PROCESSING: { label: "Processando", dot: "bg-blue-500",   text: "text-blue-700"   },
  RECORDING:  { label: "Gravando",    dot: "bg-purple-500", text: "text-purple-700" },
  PENDING:    { label: "Pendente",    dot: "bg-yellow-500", text: "text-yellow-700" },
  FAILED:     { label: "Erro",        dot: "bg-red-500",    text: "text-red-700"    },
};

const FILTROS = ["Todas", "Concluídas", "Pendentes", "Erros"] as const;
type Filtro = (typeof FILTROS)[number];

function toConsulta(c: ApiConsultation): Consulta {
  const date = new Date(c.date);
  const durationSec = c.audioRecording?.durationSec;
  return {
    id: c.id,
    paciente: c.patient.name,
    queixa: c.chiefComplaint ?? c.soapNote?.assessment?.slice(0, 60) ?? "Consulta",
    cid: c.soapNote?.icd10Codes[0],
    data: date.toLocaleDateString("pt-BR"),
    hora: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    status: c.status,
    duracao: durationSec ? `${Math.round(durationSec / 60)}min` : undefined,
  };
}

export default function HistoricoPage() {
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("Todas");
  const [busca, setBusca] = useState("");
  const [cidFiltro, setCidFiltro] = useState("");

  useEffect(() => {
    api.get<ConsultationListResponse>("/api/consultations").then((res) => {
      if (!("error" in res)) {
        setConsultas(res.data.consultations.map(toConsulta));
      }
      setCarregando(false);
    });
  }, []);

  const cids = Array.from(
    new Set(consultas.flatMap((c) => (c.cid ? [c.cid] : [])))
  ).sort();

  const filtradas = consultas.filter((c) => {
    const q = busca.toLowerCase();
    const matchBusca = !q || c.paciente.toLowerCase().includes(q) || c.queixa.toLowerCase().includes(q);
    const matchCid = !cidFiltro || c.cid === cidFiltro;
    const matchFiltro =
      filtro === "Todas"
        ? true
        : filtro === "Concluídas"
          ? c.status === "COMPLETED" || c.status === "SIGNED"
          : filtro === "Pendentes"
            ? c.status === "PENDING" || c.status === "PROCESSING" || c.status === "RECORDING"
            : c.status === "FAILED";
    return matchBusca && matchCid && matchFiltro;
  });

  const agrupado = filtradas.reduce<Record<string, Consulta[]>>((acc, c) => {
    if (!acc[c.data]) acc[c.data] = [];
    acc[c.data]!.push(c);
    return acc;
  }, {});

  const totalConcluidas = consultas.filter(
    (c) => c.status === "COMPLETED" || c.status === "SIGNED"
  ).length;

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen pb-36 lg:pb-0">
        {/* Status bar */}
        <div className="h-[47px] flex items-center px-6">
          <span className="text-[16px] font-medium font-inter text-neutral-black" suppressHydrationWarning>
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Header */}
        <div className="px-6 pb-4">
          <h1 className="font-inter font-bold text-2xl text-secondary-500 tracking-tight mb-0.5">
            Histórico
          </h1>
          <p className="text-xs text-secondary-400">
            {carregando ? "Carregando..." : `${totalConcluidas} concluídas · ${consultas.length} total`}
          </p>
        </div>

        {/* Busca */}
        <div className="px-6 mb-3">
          <div className="flex items-center bg-secondary-100 rounded-[10px] h-[46px] px-3.5 gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C7278" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar paciente ou queixa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="flex-1 bg-transparent text-sm font-inter text-secondary-500 outline-none placeholder:text-secondary-400"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="text-secondary-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filtros status */}
        <div className="flex gap-2 px-6 mb-2 overflow-x-auto pb-1">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`h-[27px] px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-all ${
                filtro === f ? "bg-primary text-white" : "bg-primary-100 text-primary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Filtro CID */}
        {cids.length > 0 && (
          <div className="flex gap-2 px-6 mb-5 overflow-x-auto pb-1">
            <button
              onClick={() => setCidFiltro("")}
              className={`h-[22px] px-2.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                !cidFiltro ? "bg-secondary-500 text-white" : "bg-secondary-100 text-secondary-400"
              }`}
            >
              Todos CIDs
            </button>
            {cids.map((cid) => (
              <button
                key={cid}
                onClick={() => setCidFiltro(cidFiltro === cid ? "" : cid)}
                className={`h-[22px] px-2.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                  cidFiltro === cid ? "bg-primary text-white" : "bg-primary-50 text-primary"
                }`}
              >
                {cid}
              </button>
            ))}
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex flex-col px-6">
          {carregando ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p className="text-secondary-400 text-sm">Carregando consultas...</p>
            </div>
          ) : Object.entries(agrupado).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ACB5BB" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="text-secondary-400 text-sm">
                {busca || cidFiltro || filtro !== "Todas"
                  ? "Nenhuma consulta encontrada."
                  : "Nenhuma consulta registrada ainda."}
              </p>
              {!busca && !cidFiltro && filtro === "Todas" && (
                <Link
                  href="/nova-consulta"
                  className="mt-1 text-sm text-primary font-medium underline underline-offset-2"
                >
                  Iniciar primeira consulta
                </Link>
              )}
            </div>
          ) : (
            Object.entries(agrupado).map(([data, items]) => (
              <div key={data} className="mb-6">
                {/* Data label */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary-100 shrink-0" />
                  <p className="text-xs font-semibold font-jakarta text-secondary-400 uppercase tracking-wider">
                    {formatDate(data)}
                  </p>
                  <div className="flex-1 h-px bg-secondary-100" />
                  <span className="text-[10px] bg-secondary-100 text-secondary-400 rounded-full px-2 py-0.5">
                    {items.length} {items.length === 1 ? "consulta" : "consultas"}
                  </span>
                </div>

                {/* Cards com linha lateral */}
                <div className="relative ml-1.5 border-l-2 border-primary-100 pl-5 flex flex-col gap-2">
                  {items.map((c) => {
                    const st = STATUS[c.status];
                    return (
                      <Link
                        key={c.id}
                        href={`/historico/${c.id}`}
                        className="relative flex items-center gap-3 bg-white border border-secondary-100 rounded-2xl px-3.5 py-3 active:scale-[0.98] transition-all animate-fade-in shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                      >
                        <div className={`absolute -left-[22px] w-2.5 h-2.5 rounded-full ${st.dot} ring-2 ring-white`} />

                        <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-secondary-500 truncate">{c.paciente}</p>
                          <p className="text-xs text-secondary-400 truncate">{c.queixa}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-secondary-300">{c.hora}</span>
                            {c.duracao && <span className="text-[10px] text-secondary-300">· {c.duracao}</span>}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {c.cid && (
                            <span className="text-[10px] font-semibold bg-primary-50 text-primary border border-primary-100 rounded-full px-2 py-0.5">
                              {c.cid}
                            </span>
                          )}
                          <span className={`text-[10px] font-medium ${st.text}`}>{st.label}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ACB5BB" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </MobileScreen>
  );
}

function formatDate(d: string): string {
  const today = new Date().toLocaleDateString("pt-BR");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("pt-BR");
  if (d === today) return "Hoje";
  if (d === yesterday) return "Ontem";
  return d;
}
