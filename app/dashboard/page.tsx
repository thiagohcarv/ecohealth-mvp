"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { api, type ConsultationListResponse, type ConsultationItem } from "@/lib/api";
import { getUser } from "@/lib/auth";

type Status = "PENDING" | "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "SIGNED";

interface Consulta {
  id: string;
  paciente: string;
  queixa: string;
  data: string;
  hora: string;
  status: Status;
  duracao?: string;
}

const MOCK: Consulta[] = [
  { id: "1", paciente: "João da Silva",    queixa: "Cefaleia tensional",   data: "04/06/2026", hora: "09:00", status: "COMPLETED", duracao: "18min" },
  { id: "2", paciente: "Maria Oliveira",   queixa: "Diabetes Tipo 2",     data: "04/06/2026", hora: "10:30", status: "COMPLETED", duracao: "22min" },
  { id: "3", paciente: "Carlos Santos",    queixa: "Lombalgia mecânica",  data: "04/06/2026", hora: "11:45", status: "PROCESSING" },
  { id: "4", paciente: "Ana Fernandes",    queixa: "Asma brônquica",      data: "04/06/2026", hora: "14:00", status: "PENDING" },
  { id: "5", paciente: "Pedro Rodrigues",  queixa: "HAS estágio 1",       data: "04/06/2026", hora: "15:00", status: "COMPLETED", duracao: "14min" },
];

const CHART = [
  { day: "Seg", n: 4 }, { day: "Ter", n: 7 }, { day: "Qua", n: 5 },
  { day: "Qui", n: 9 }, { day: "Sex", n: 6 }, { day: "Sáb", n: 3 }, { day: "Dom", n: 1 },
];
const CHART_MAX = Math.max(...CHART.map((c) => c.n));

const STATUS_CFG: Record<Status, { dot: string; text: string; label: string }> = {
  COMPLETED:  { dot: "bg-green-500",  text: "text-green-700",  label: "Concluída"    },
  SIGNED:     { dot: "bg-green-600",  text: "text-green-800",  label: "Assinada"     },
  PROCESSING: { dot: "bg-blue-500",   text: "text-blue-700",   label: "Processando"  },
  RECORDING:  { dot: "bg-purple-500", text: "text-purple-700", label: "Gravando"     },
  PENDING:    { dot: "bg-yellow-500", text: "text-yellow-700", label: "Pendente"     },
  FAILED:     { dot: "bg-red-500",    text: "text-red-700",    label: "Erro"         },
};

function toConsulta(item: ConsultationItem): Consulta {
  const d = new Date(item.date);
  return {
    id: item.id,
    paciente: item.patient.name,
    queixa: item.chiefComplaint ?? "Consulta geral",
    data: d.toLocaleDateString("pt-BR"),
    hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    status: item.status as Status,
  };
}

export default function DashboardPage() {
  const [consultas, setConsultas] = useState<Consulta[]>(MOCK);
  const [offline, setOffline] = useState(false);
  const [firstName, setFirstName] = useState("Doutor(a)");

  useEffect(() => {
    setFirstName(getUser()?.nome?.split(" ")[0] ?? "Doutor(a)");
    api.get<ConsultationListResponse>("/api/consultations").then((r) => {
      if (r.error || !r.data) { setOffline(true); return; }
      setConsultas(r.data.consultations.map(toConsulta));
    });
  }, []);

  const hoje   = consultas.filter((c) => c.status === "COMPLETED").length;
  const total  = consultas.length;
  const horasSalvas = consultas.filter((c) => c.duracao).reduce((acc, c) => {
    const min = parseInt(c.duracao ?? "0");
    return acc + min * 0.4;
  }, 0);
  const recentes = consultas.slice(0, 5);

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen pb-36 lg:pb-0">
        {/* Status bar */}
        <div className="h-[47px] flex items-center justify-between px-6">
          <span className="text-[16px] font-medium font-inter text-neutral-black">
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <div className="flex items-center gap-1">
            {offline && <span className="text-[10px] text-secondary-300 italic">offline</span>}
            <BatteryIcon />
          </div>
        </div>

        {/* Saudação */}
        <div className="px-6 pt-1 pb-4">
          <p className="text-xs text-secondary-400 mb-0.5">
            {greeting()}, Dr(a). {firstName} 👋
          </p>
          <h1 className="font-inter font-bold text-2xl text-secondary-500 tracking-tight leading-tight">
            Seus resultados<br />de hoje
          </h1>
        </div>

        {/* Stats grid 2×2 */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 px-6 mb-5">
          <StatCard
            label="Consultas hoje"
            value={String(hoje)}
            sub="concluídas"
            color="bg-primary text-white"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>}
          />
          <StatCard
            label="Total sprint"
            value={String(total)}
            sub="consultas"
            color="bg-secondary-100"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          />
          <StatCard
            label="Tempo poupado"
            value={`${horasSalvas.toFixed(0)}min`}
            sub="vs. digitação"
            color="bg-secondary-100"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          />
          <StatCard
            label="SOAPs gerados"
            value={String(hoje)}
            sub="com IA"
            color="bg-primary-50"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M12 2a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>}
          />
        </div>

        {/* Gráfico — consultas por dia */}
        <div className="mx-6 bg-secondary-100 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-secondary-500">Consultas — últimos 7 dias</p>
            <span className="text-[10px] text-secondary-400 bg-white rounded-full px-2 py-0.5">
              {CHART.reduce((a, c) => a + c.n, 0)} total
            </span>
          </div>
          <div className="flex items-end justify-between gap-1 h-16">
            {CHART.map((c, i) => (
              <div key={c.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: "48px" }}>
                  <div
                    className={`w-full rounded-t-lg transition-all ${i === 6 ? "bg-secondary-300" : i === 3 ? "bg-primary" : "bg-primary-100"}`}
                    style={{ height: `${Math.round((c.n / CHART_MAX) * 48)}px`, minHeight: "4px" }}
                  />
                </div>
                <span className="text-[9px] text-secondary-400">{c.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas consultas */}
        <div className="px-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold font-jakarta text-secondary-400 uppercase tracking-wider">
              Últimas consultas
            </p>
            <Link href="/historico" className="text-xs text-primary font-medium">
              Ver todas →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {recentes.map((c) => {
              const st = STATUS_CFG[c.status];
              return (
                <Link
                  key={c.id}
                  href={`/historico/${c.id}`}
                  className="flex items-center gap-3 bg-primary-100 rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform animate-fade-in"
                >
                  <div className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-500 truncate">{c.paciente}</p>
                    <p className="text-xs text-secondary-400 truncate">{c.queixa}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-secondary-300">{c.hora}</span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${st?.dot ?? "bg-secondary-300"}`} />
                      <span className={`text-[10px] font-medium ${st?.text ?? "text-secondary-400"}`}>{st?.label ?? c.status}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <BottomNav />
    </MobileScreen>
  );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <div className="flex items-start justify-between mb-2">
        <p className={`text-[11px] font-medium leading-tight ${color.includes("bg-primary text") ? "text-white/80" : "text-secondary-400"}`}>
          {label}
        </p>
        <div className="opacity-80">{icon}</div>
      </div>
      <p className={`text-2xl font-bold font-inter tracking-tight ${color.includes("bg-primary text") ? "text-white" : "text-secondary-500"}`}>
        {value}
      </p>
      <p className={`text-[11px] mt-0.5 ${color.includes("bg-primary text") ? "text-white/70" : "text-secondary-400"}`}>
        {sub}
      </p>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function BatteryIcon() {
  return <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.5" y="0.5" width="23" height="12" rx="2.5" stroke="#021433"/><rect x="2" y="2" width="20" height="9" rx="1.5" fill="#021433"/><path d="M25 4.5v4" stroke="#021433" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
