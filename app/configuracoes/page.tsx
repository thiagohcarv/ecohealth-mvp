"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { BottomNav } from "@/components/ui/BottomNav";
import { api, type MeResponse } from "@/lib/api";
import { clearAuth } from "@/lib/auth";

interface BillingStatus {
  plan: "trial" | "pro";
  daysRemaining: number;
  isExpired: boolean;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="px-6 pt-5 pb-2 text-xs font-semibold font-inter text-secondary-400 uppercase tracking-wider">
      {title}
    </p>
  );
}

function SettingRow({
  icon, label, sub, right, onClick, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const interactive = onClick != null;
  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={`w-full flex items-center gap-4 px-6 py-3.5 transition-colors ${interactive ? "cursor-pointer active:bg-secondary-100" : ""}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? "bg-red-50" : "bg-primary-50"}`}>
        {icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-medium font-inter ${danger ? "text-red-500" : "text-secondary-500"}`}>{label}</p>
        {sub && <p className="text-xs text-secondary-400 truncate">{sub}</p>}
      </div>
      {right ?? (interactive ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ACB5BB" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      ) : null)}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-secondary-100 mx-6" />;
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [me, setMe] = useState<MeResponse["user"] | null>(null);

  useEffect(() => {
    api.get<BillingStatus>("/api/billing/status").then((r) => { if (!r.error && r.data) setBilling(r.data); });
    api.get<MeResponse>("/api/auth/me").then((r) => { if (!r.error && r.data) setMe(r.data.user); });
  }, []);

  async function handleLogout() {
    await api.post("/api/auth/logout", {}); // revoga o token no servidor
    clearAuth();
    router.push("/login");
  }

  const plano = billing?.plan ?? "trial";
  const diasTrial = billing?.daysRemaining ?? 30;
  const isExpired = billing?.isExpired ?? false;
  const isLowTrial = plano === "trial" && diasTrial <= 7 && !isExpired;

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen pb-36 lg:pb-0">
        <div className="h-[47px] flex items-center px-6">
          <span className="text-[16px] font-medium font-inter text-neutral-black" suppressHydrationWarning>
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="px-6 pb-5">
          <h1 className="font-inter font-bold text-2xl text-secondary-500 tracking-tight">Configurações</h1>
        </div>

        {(isExpired || isLowTrial) && (
          <div className={`mx-6 mb-3 rounded-2xl px-4 py-3 ${isExpired ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
            <p className={`text-xs font-medium ${isExpired ? "text-red-600" : "text-amber-700"}`}>
              {isExpired
                ? "Seu período de teste terminou. Fale com a equipe EcoHealth para continuar."
                : `Seu período de teste termina em ${diasTrial} dia${diasTrial === 1 ? "" : "s"}.`}
            </p>
          </div>
        )}

        <div className="mx-6 mb-2">
          {plano === "trial" ? (
            <div className={`rounded-2xl p-4 text-white ${isExpired ? "bg-red-500" : "bg-gradient-to-br from-primary to-primary-600"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">{isExpired ? "ENCERRADO" : "TRIAL"}</span>
                {!isExpired && <span className="text-xs text-white/70">{diasTrial} dias restantes</span>}
              </div>
              <p className="text-base font-bold">Plano Gratuito</p>
              <p className="text-xs text-white/70 mt-0.5">{isExpired ? "Período de teste encerrado" : "Acesso completo durante o alpha"}</p>
              {!isExpired && (
                <div className="mt-3 h-1.5 bg-white/20 rounded-full">
                  <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, (diasTrial / 30) * 100)}%` }} />
                </div>
              )}
              <div className="mt-3 w-full h-9 bg-white/20 rounded-xl text-white text-sm font-medium font-inter flex items-center justify-center">
                Plano Pro — em breve
              </div>
            </div>
          ) : (
            <div className="bg-secondary-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-secondary-500">Plano Pro</p>
                  <span className="text-[10px] font-bold bg-[#22C55E] text-white rounded-full px-2 py-0.5">PRO</span>
                </div>
                <p className="text-xs text-secondary-400">Ativo</p>
              </div>
            </div>
          )}
        </div>

        <SectionHeader title="Conta" />
        <div className="bg-white">
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            label="Nome"
            sub={me?.name ?? "—"}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
            label="E-mail"
            sub={me?.email ?? "—"}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="CRM"
            sub={me?.crm ?? "—"}
          />
        </div>

        <SectionHeader title="Sobre" />
        <div className="bg-white">
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="Versão"
            sub="EcoHealth 0.1.0-alpha"
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
            label="Termos de Uso e Privacidade"
            onClick={() => router.push("/lgpd?next=/configuracoes")}
          />
        </div>

        <SectionHeader title="Sessão" />
        <div className="bg-white mb-4">
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
            label="Sair"
            danger
            right={<span />}
            onClick={handleLogout}
          />
        </div>
      </div>

      <BottomNav />
    </MobileScreen>
  );
}
