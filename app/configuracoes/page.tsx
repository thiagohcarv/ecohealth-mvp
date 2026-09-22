"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { BottomNav } from "@/components/ui/BottomNav";
import { usePreferences } from "@/app/hooks/usePreferences";
import { t, AI_MODEL_LABELS } from "@/lib/i18n";
import type { Lang, AiModel } from "@/lib/preferences";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface BillingStatus {
  plan: "trial" | "pro";
  daysRemaining: number;
  isExpired: boolean;
  trialEndsAt: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${checked ? "bg-primary" : "bg-secondary-300"}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex bg-secondary-100 rounded-lg overflow-hidden">
      {(["pt-BR", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={(e) => { e.stopPropagation(); onChange(l); }}
          className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${
            lang === l
              ? "bg-primary text-white"
              : "text-secondary-400 hover:text-secondary-500"
          }`}
        >
          {l === "pt-BR" ? "PT" : "EN"}
        </button>
      ))}
    </div>
  );
}

function ModelPickerRow({
  model, onChange, label,
}: { model: AiModel; onChange: (m: AiModel) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const current = AI_MODEL_LABELS[model];

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-6 py-3.5 active:bg-secondary-100 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2">
            <path d="M12 2a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
          </svg>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium font-inter text-secondary-500">{label}</p>
          <p className="text-xs text-secondary-400 truncate">
            {current.badge} · {current.sub}
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ACB5BB" strokeWidth="2"
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {open && (
        <div className="bg-primary-50 border-t border-b border-secondary-100">
          {(Object.entries(AI_MODEL_LABELS) as [AiModel, { badge: string; sub: string }][]).map(
            ([value, info], i) => (
              <button
                key={value}
                onClick={() => { onChange(value); setOpen(false); }}
                className={`w-full flex items-center gap-4 px-6 py-3 transition-colors hover:bg-white/50 ${
                  i > 0 ? "border-t border-secondary-100" : ""
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  model === value ? "border-primary" : "border-secondary-300"
                }`}>
                  {model === value && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium font-inter ${
                    model === value ? "text-primary" : "text-secondary-500"
                  }`}>
                    {info.badge}
                  </p>
                  <p className="text-[11px] text-secondary-400">{info.sub}</p>
                </div>
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-semibold font-jakarta text-secondary-400 uppercase tracking-widest px-6 mb-2 mt-5">
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
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        danger ? "bg-red-50" : "bg-primary-50"
      }`}>
        {icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-medium font-inter ${
          danger ? "text-red-500" : "text-secondary-500"
        }`}>
          {label}
        </p>
        {sub && <p className="text-xs text-secondary-400 truncate">{sub}</p>}
      </div>
      {right ?? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ACB5BB" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-secondary-100 mx-6" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { prefs, update } = usePreferences();
  const [notifConsulta, setNotifConsulta] = useState(true);
  const [notifSoap, setNotifSoap] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("eco_token");
    if (!token) return;
    fetch(`${API_URL}/api/billing/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setBilling(data as BillingStatus);
      })
      .catch(() => {});
  }, []);

  async function handleUpgrade() {
    const token = localStorage.getItem("eco_token");
    if (!token) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { checkoutUrl?: string };
      if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank");
    } catch {
      /* silent */
    } finally {
      setCheckoutLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("eco_token");
    localStorage.removeItem("eco_user");
    router.push("/login");
  }

  const lang = prefs.lang;
  const plano = billing?.plan ?? "trial";
  const diasTrial = billing?.daysRemaining ?? 30;
  const isExpired = billing?.isExpired ?? false;
  const isLowTrial = plano === "trial" && diasTrial <= 7 && !isExpired;

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
        <div className="px-6 pb-5">
          <h1 className="font-inter font-bold text-2xl text-secondary-500 tracking-tight">
            {t(lang, "settings")}
          </h1>
        </div>

        {/* Trial expiry warning */}
        {(isExpired || isLowTrial) && (
          <div className={`mx-6 mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 ${
            isExpired ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"
          }`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isExpired ? "#ef4444" : "#F59E0B"} strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className={`text-xs font-medium flex-1 ${isExpired ? "text-red-600" : "text-amber-700"}`}>
              {isExpired
                ? "Seu trial expirou. Assine o Plano Pro para continuar gerando PDFs."
                : `Seu trial expira em ${diasTrial} dia${diasTrial === 1 ? "" : "s"}. Faça upgrade para não perder acesso.`}
            </p>
          </div>
        )}

        {/* Plano card */}
        <div className="mx-6 mb-2">
          {plano === "trial" ? (
            <div className={`rounded-2xl p-4 text-white ${isExpired ? "bg-red-500" : "bg-gradient-to-br from-primary to-primary-600"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">
                      {isExpired ? "EXPIRADO" : "TRIAL"}
                    </span>
                    {!isExpired && (
                      <span className="text-xs text-white/70">{diasTrial} dias restantes</span>
                    )}
                  </div>
                  <p className="text-base font-bold">Plano Gratuito</p>
                  <p className="text-xs text-white/70 mt-0.5">
                    {isExpired ? "Assine para continuar" : "Mocks ativos · 20 consultas/mês"}
                  </p>
                </div>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              {!isExpired && (
                <div className="mt-3">
                  <div className="h-1.5 bg-white/20 rounded-full">
                    <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, (diasTrial / 30) * 100)}%` }} />
                  </div>
                </div>
              )}
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="mt-3 w-full h-9 bg-white rounded-xl text-primary text-sm font-bold font-inter disabled:opacity-70 transition-opacity"
              >
                {checkoutLoading ? "Aguarde..." : "Assinar Plano Pro — R$197/mês →"}
              </button>
            </div>
          ) : (
            <div className="bg-secondary-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#22C55E] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-secondary-500">Plano Pro</p>
                  <span className="text-[10px] font-bold bg-[#22C55E] text-white rounded-full px-2 py-0.5">PRO</span>
                </div>
                <p className="text-xs text-secondary-400">Ilimitado · Ativo</p>
              </div>
            </div>
          )}
        </div>

        {/* Conta */}
        <SectionHeader title={t(lang, "sAccount")} />
        <div className="bg-white">
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            label={t(lang, "personalData")}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
            label={t(lang, "email")}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
            label={t(lang, "changePassword")}
          />
        </div>

        {/* Notificações */}
        <SectionHeader title={t(lang, "sNotifications")} />
        <div className="bg-white">
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
            label={t(lang, "newConsultation")}
            sub={t(lang, "newConsultationSub")}
            right={<Toggle checked={notifConsulta} onChange={setNotifConsulta} />}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            label={t(lang, "soapGenerated")}
            sub={t(lang, "soapSub")}
            right={<Toggle checked={notifSoap} onChange={setNotifSoap} />}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/></svg>}
            label={t(lang, "weeklyEmail")}
            right={<Toggle checked={notifEmail} onChange={setNotifEmail} />}
          />
        </div>

        {/* Preferências */}
        <SectionHeader title={t(lang, "sPreferences")} />
        <div className="bg-white">
          {/* Idioma */}
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>}
            label={t(lang, "language")}
            right={<LangToggle lang={lang} onChange={(l) => update({ lang: l })} />}
          />
          <Divider />
          {/* Modelo de IA — picker expandível */}
          <ModelPickerRow
            model={prefs.aiModel}
            onChange={(m) => update({ aiModel: m })}
            label={t(lang, "aiModel")}
          />
        </div>

        {/* Sobre */}
        <SectionHeader title={t(lang, "sAbout")} />
        <div className="bg-white">
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label={t(lang, "version")}
            sub="EcoHealth 0.1.0-alpha"
            right={<span className="text-[11px] text-secondary-300">0.1.0</span>}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            label={t(lang, "terms")}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
            label={t(lang, "privacy")}
          />
        </div>

        {/* Sessão */}
        <SectionHeader title={t(lang, "sSession")} />
        <div className="bg-white mb-4">
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
            label={t(lang, "logout")}
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
