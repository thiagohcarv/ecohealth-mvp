"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { api, type AuthResponse } from "@/lib/api";
import { setPendingEmail } from "@/lib/auth";

const UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface CadastroForm {
  nome: string;
  cpf: string;
  email: string;
  crm: string;
  uf: string;
  dataNascimento: string;
  telefone: string;
  senha: string;
}

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState<CadastroForm>({
    nome: "",
    cpf: "",
    email: "",
    crm: "",
    uf: "SP",
    dataNascimento: "",
    telefone: "",
    senha: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CadastroForm, string>>>({});
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("eco_lgpd_pending")) {
      router.replace("/lgpd");
    }
  }, [router]);

  function validate(): boolean {
    const e: Partial<Record<keyof CadastroForm, string>> = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.cpf.trim()) e.cpf = "CPF obrigatório";
    if (!form.email.trim()) e.email = "Email obrigatório";
    if (!form.crm.trim()) e.crm = "CRM obrigatório";
    if (!form.senha || form.senha.length < 6) e.senha = "Mínimo 6 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setApiError("");
    if (!validate()) return;

    setLoading(true);
    const result = await api.post<AuthResponse>("/api/auth/register", {
      email: form.email,
      senha: form.senha,
      nome: form.nome,
      crm: form.crm,
      uf: form.uf,
      cpf: form.cpf || undefined,
      telefone: form.telefone || undefined,
    });
    setLoading(false);

    if (result.error) {
      setApiError(result.error);
      return;
    }

    setPendingEmail(form.email);
    router.push("/verificar");
  }

  const set = (field: keyof CadastroForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (

    <MobileScreen>
      <div className="flex flex-col min-h-screen">
        {/* Header com back */}
        <div className="flex items-center px-[37px] pt-[75px] pb-4">
          <Link
            href="/login"
            className="text-secondary-500 hover:text-secondary-400 transition-colors"
            aria-label="Voltar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>

        <div className="px-[37px] pb-8 flex flex-col gap-0 animate-fade-in">
          {/* Título */}
          <div className="flex flex-col gap-3 mb-5">
            <h1 className="font-inter font-bold text-[32px] text-secondary-500 tracking-[-0.64px] leading-[1.3]">
              Crie sua conta
            </h1>
            <p className="text-xs font-medium font-inter text-secondary-400 tracking-[-0.12px] leading-[1.4]">
              Registre-se para continuar!
            </p>
          </div>

          {/* Campos */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-[19px]">
            <Input
              label="Nome completo"
              type="text"
              placeholder="Dr. João Silva"
              value={form.nome}
              onChange={set("nome")}
              error={errors.nome}
              autoComplete="name"
            />
            <Input
              label="CPF"
              type="text"
              placeholder="000.000.000-00"
              value={form.cpf}
              onChange={set("cpf")}
              error={errors.cpf}
              autoComplete="off"
              maxLength={14}
            />
            <Input
              label="Email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={form.email}
              onChange={set("email")}
              error={errors.email}
              autoComplete="email"
            />
            {/* UF + CRM em linha */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-center h-[21px]">
                <span className="text-xs font-medium font-jakarta text-secondary-400 tracking-[-0.24px]">
                  CRM
                </span>
              </div>
              <div className="flex gap-2">
                <select
                  value={form.uf}
                  onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
                  className="w-[72px] bg-white border border-secondary-100 rounded-[10px] input-shadow h-[46px] px-2 text-sm font-medium font-inter text-secondary-500 outline-none appearance-none text-center"
                  aria-label="UF do CRM"
                >
                  {UF_LIST.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
                <div className="flex-1">
                  <Input
                    label=""
                    type="text"
                    placeholder="123456"
                    value={form.crm}
                    onChange={set("crm")}
                    error={errors["crm"]}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
            <Input
              label="Data de Nascimento"
              type="text"
              placeholder="DD/MM/AAAA"
              value={form.dataNascimento}
              onChange={set("dataNascimento")}
              rightIcon={<CalendarIcon />}
              autoComplete="bday"
            />

            {/* Campo de telefone com DDI */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-center h-[21px]">
                <span className="text-xs font-medium font-jakarta text-secondary-400 tracking-[-0.24px]">
                  Número de telefone
                </span>
              </div>
              <div className="flex items-center bg-white border border-secondary-100 rounded-[10px] input-shadow h-[46px] overflow-hidden">
                <div className="flex items-center gap-1.5 px-3.5 h-full border-r border-secondary-100 bg-white">
                  <span className="text-sm font-medium font-inter text-secondary-500">🇧🇷</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6C7278" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={form.telefone}
                  onChange={set("telefone")}
                  className="flex-1 px-3.5 text-sm font-medium font-inter text-secondary-500 tracking-[-0.14px] bg-transparent outline-none placeholder:text-secondary-300"
                  autoComplete="tel"
                />
              </div>
            </div>

            <Input
              label="Sua senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.senha}
              onChange={set("senha")}
              error={errors.senha}
              autoComplete="new-password"
            />

            {apiError && (
              <p className="text-xs text-red-500 text-center -mt-1 px-1">{apiError}</p>
            )}

            <div className="mt-1">
              <Button type="submit" loading={loading}>
                Criar conta
              </Button>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="text-xs font-medium font-inter text-secondary-400">
                Já tem conta?
              </span>
              <Link
                href="/login"
                className="text-xs font-semibold font-inter text-info"
              >
                Entrar
              </Link>
            </div>

            <div className="flex items-center justify-center mt-1">
              <Link
                href="/lgpd"
                className="text-[11px] font-medium font-inter text-secondary-300 underline underline-offset-2"
              >
                Ver Política de Privacidade
              </Link>
            </div>
          </form>
        </div>
      </div>
    </MobileScreen>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
