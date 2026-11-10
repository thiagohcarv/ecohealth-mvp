"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EcoHealthLogo } from "@/components/EcoHealthLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, type MeResponse } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cpfValido, dataNascimentoValida } from "@/lib/validacao";

/** Destino seguro: apenas caminhos internos. */
function destino(): string {
  if (typeof window === "undefined") return "/dashboard";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && next !== "/completar-cadastro" ? next : "/dashboard";
}

/**
 * Cadastro incompleto: CPF e data de nascimento são obrigatórios para usar o sistema
 * (exigidos para emissão de receitas — RDC 1000/25). Sem eles, o acesso fica bloqueado aqui.
 */
export default function CompletarCadastroPage() {
  const router = useRouter();
  const [faltaCpf, setFaltaCpf] = useState(false);
  const [faltaNasc, setFaltaNasc] = useState(false);
  const [cpf, setCpf] = useState("");
  const [nasc, setNasc] = useState("");
  const [erros, setErros] = useState<{ cpf?: string; nasc?: string }>({});
  const [apiErro, setApiErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api.get<MeResponse>("/api/auth/me").then((r) => {
      if (r.error || !r.data) {
        setApiErro(r.error ?? "Não foi possível carregar seu cadastro.");
        setCarregando(false);
        return;
      }
      const u = r.data.user;
      if (u.cpf && u.birthDate) {
        router.replace(destino()); // já está completo
        return;
      }
      setFaltaCpf(!u.cpf);
      setFaltaNasc(!u.birthDate);
      setCarregando(false);
    });
  }, [router]);

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setApiErro("");
    const e: { cpf?: string; nasc?: string } = {};
    if (faltaCpf && !cpfValido(cpf)) e.cpf = "CPF inválido";
    if (faltaNasc && !dataNascimentoValida(nasc)) e.nasc = "Use o formato DD/MM/AAAA";
    setErros(e);
    if (Object.keys(e).length) return;

    setSalvando(true);
    const r = await api.patch<MeResponse>("/api/auth/me", {
      ...(faltaCpf ? { cpf } : {}),
      ...(faltaNasc ? { birthDate: nasc } : {}),
    });
    setSalvando(false);
    if (r.error) {
      setApiErro(r.error);
      return;
    }
    try {
      if (r.data?.user.id) sessionStorage.setItem("eco_profile_ok", r.data.user.id);
    } catch {
      /* armazenamento indisponível: o layout confere de novo */
    }
    router.replace(destino());
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8F9FF] px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex justify-center mb-8">
          <EcoHealthLogo size="md" />
        </div>
        <div className="flex flex-col gap-3 mb-6">
          <h1 className="font-inter font-bold text-[28px] text-secondary-500 tracking-[-0.56px] leading-[1.3] text-center">
            Complete seu cadastro
          </h1>
          <p className="text-xs font-medium font-inter text-secondary-400 leading-[1.4] text-center">
            CPF e data de nascimento são obrigatórios para usar o EcoHealth e emitir receitas digitais.
          </p>
        </div>

        {carregando ? (
          <p className="text-sm text-secondary-400 text-center">{apiErro || "Carregando..."}</p>
        ) : (
          <form onSubmit={salvar} className="flex flex-col gap-[19px]">
            {faltaCpf && (
              <Input
                label="CPF"
                placeholder="000.000.000-00"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                error={erros.cpf}
              />
            )}
            {faltaNasc && (
              <Input
                label="Data de Nascimento"
                placeholder="DD/MM/AAAA"
                value={nasc}
                onChange={(e) => setNasc(e.target.value)}
                error={erros.nasc}
                autoComplete="bday"
              />
            )}
            {apiErro && <p className="text-xs text-red-500 text-center">{apiErro}</p>}
            <Button type="submit" loading={salvando}>
              Salvar e continuar
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
