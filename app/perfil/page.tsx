"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { BottomNav } from "@/components/ui/BottomNav";
import { getUser } from "@/lib/auth";

interface StatItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function Avatar({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const dim = size === "lg" ? "w-20 h-20 text-2xl" : "w-10 h-10 text-sm";
  return (
    <div className={`${dim} rounded-full bg-primary flex items-center justify-center font-bold text-white shrink-0`}>
      {initials}
    </div>
  );
}

function StatCard({ item }: { item: StatItem }) {
  return (
    <div className={`rounded-2xl p-4 ${item.color}`}>
      <div className="mb-1">{item.icon}</div>
      <p className="text-xl font-bold font-inter text-secondary-500">{item.value}</p>
      <p className="text-[11px] text-secondary-400 leading-tight mt-0.5">{item.label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-secondary-100 last:border-0 px-6">
      <p className="text-xs text-secondary-400">{label}</p>
      <p className="text-sm font-medium text-secondary-500 text-right">{value}</p>
    </div>
  );
}

const CID_TOP = [
  { cid: "G44.2", desc: "Cefaleia tensional", n: 8 },
  { cid: "I10",   desc: "HAS",                n: 5 },
  { cid: "E11.9", desc: "Diabetes T2",        n: 4 },
  { cid: "M54.5", desc: "Lombalgia",          n: 3 },
];

export default function PerfilPage() {
  const user = getUser();
  const [editando, setEditando] = useState(false);
  const nome = user?.nome ?? "Dr. Médico Especialista";
  const crm  = user?.crm  ?? "CRM/SP-123456";

  const STATS: StatItem[] = [
    {
      label: "Total de consultas",
      value: "127",
      color: "bg-primary-50",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    },
    {
      label: "Horas economizadas",
      value: "50h",
      color: "bg-green-50",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      label: "SOAPs gerados",
      value: "119",
      color: "bg-purple-50",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2"><path d="M12 2a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>,
    },
    {
      label: "Acurácia IA",
      value: "94%",
      color: "bg-amber-50",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    },
  ];

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen pb-36 lg:pb-0">
        {/* Status bar */}
        <div className="h-[47px] flex items-center justify-between px-6">
          <span className="text-[16px] font-medium font-inter text-neutral-black">
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <Link href="/configuracoes" className="text-secondary-400" aria-label="Configurações">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </Link>
        </div>

        {/* Hero perfil */}
        <div className="px-6 pb-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <Avatar name={nome} />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-inter font-bold text-xl text-secondary-500 truncate">{nome}</h1>
              <p className="text-xs text-secondary-400">{crm}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] bg-primary-50 text-primary font-medium rounded-full px-2 py-0.5">
                  Clínica Geral
                </span>
                <span className="text-[10px] bg-secondary-100 text-secondary-400 rounded-full px-2 py-0.5">
                  São Paulo · SP
                </span>
              </div>
            </div>
            <button
              onClick={() => setEditando(!editando)}
              className={`h-8 px-3 rounded-xl text-xs font-medium transition-colors ${
                editando ? "bg-primary text-white" : "bg-primary-100 text-primary"
              }`}
            >
              {editando ? "Salvar" : "Editar"}
            </button>
          </div>

          {/* Badge trial */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="text-xs text-primary font-medium">Plano Trial · 12 dias restantes</span>
            <Link href="/configuracoes" className="ml-auto text-[11px] text-primary font-semibold underline underline-offset-2">
              Upgrade
            </Link>
          </div>
        </div>

        {/* Stats 2×2 */}
        <div className="px-6 mb-5">
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s) => <StatCard key={s.label} item={s} />)}
          </div>
        </div>

        {/* Informações médicas */}
        <div className="mb-5">
          <p className="text-[11px] font-semibold font-jakarta text-secondary-400 uppercase tracking-widest px-6 mb-2">
            Dados Profissionais
          </p>
          <div className="bg-white">
            <InfoRow label="CRM" value={crm} />
            <InfoRow label="Especialidade" value="Clínica Geral" />
            <InfoRow label="Estado" value="São Paulo — SP" />
            <InfoRow label="CFM" value="Ativo" />
            <InfoRow label="Membro desde" value="Junho 2026" />
          </div>
        </div>

        {/* CIDs mais frequentes */}
        <div className="px-6 mb-5">
          <p className="text-[11px] font-semibold font-jakarta text-secondary-400 uppercase tracking-widest mb-3">
            CIDs mais frequentes
          </p>
          <div className="flex flex-col gap-2">
            {CID_TOP.map((c, i) => (
              <div key={c.cid} className="flex items-center gap-3 bg-secondary-100 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-secondary-300 w-4">{i + 1}</span>
                <span className="text-xs font-bold text-primary bg-primary-50 rounded-full px-2 py-0.5 shrink-0">
                  {c.cid}
                </span>
                <span className="text-xs text-secondary-500 flex-1 truncate">{c.desc}</span>
                <span className="text-xs font-semibold text-secondary-400">{c.n}×</span>
              </div>
            ))}
          </div>
        </div>

        {/* Link para configurações */}
        <div className="px-6 pb-4">
          <Link
            href="/configuracoes"
            className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl border border-secondary-100 text-secondary-400 text-sm font-medium font-inter"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Configurações avançadas
          </Link>
        </div>
      </div>

      <BottomNav />
    </MobileScreen>
  );
}
