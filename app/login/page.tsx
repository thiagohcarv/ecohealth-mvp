"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EcoHealthLogo } from "@/components/EcoHealthLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, type AuthResponse } from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", senha: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.email || !form.senha) {
      setError("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    const result = await api.post<AuthResponse>("/api/auth/login", {
      email: form.email,
      senha: form.senha,
    });
    setLoading(false);

    if (result.error || !result.data) {
      setError(result.error ?? "Erro desconhecido");
      return;
    }

    const { token, userId, nome } = result.data;
    if (token && userId && nome) {
      setToken(token);
      setUser({ userId, nome });

      // Aceite obrigatório (LGPD + Termos de Uso): sem ele, não entra no app
      const consent = await api.get<{ hasConsent: boolean }>("/api/auth/lgpd-consent");
      if (!("error" in consent) && !consent.data.hasConsent) {
        router.push("/lgpd?next=/dashboard");
        return;
      }
      router.push("/dashboard");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8F9FF] px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <EcoHealthLogo size="md" />
        </div>

        {/* Título */}
        <div className="flex flex-col gap-3 mb-8 animate-fade-in">
          <h1 className="font-inter font-bold text-[32px] text-secondary-500 tracking-[-0.64px] leading-[1.3] text-center">
            Entrar na sua Conta
          </h1>
          <p className="text-xs font-medium font-inter text-secondary-400 tracking-[-0.12px] leading-[1.4] text-center">
            Digite seu email e senha para entrar
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              autoComplete="email"
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center -mt-2">{error}</p>
          )}

          <div className="flex flex-col gap-6">
            <Button type="submit" loading={loading}>
              Entrar
            </Button>
          </div>

          {/* Link de cadastro */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <span className="text-xs font-medium font-inter text-secondary-400 tracking-[-0.12px]">
              Não tem conta?
            </span>
            <Link
              href="/lgpd"
              className="text-xs font-semibold font-inter text-info tracking-[-0.12px]"
            >
              Cadastrar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}


