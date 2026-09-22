"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EcoHealthLogo } from "@/components/EcoHealthLogo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MobileScreen } from "@/components/layout/MobileScreen";
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
      router.push("/dashboard");
    }
  }

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen px-[37px] pt-[97px] pb-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <EcoHealthLogo size="md" />
        </div>

        {/* Título */}
        <div className="flex flex-col gap-3 mb-8 animate-fade-in">
          <h1 className="font-inter font-bold text-[32px] text-secondary-500 tracking-[-0.64px] leading-[1.3]">
            Entrar na sua Conta
          </h1>
          <p className="text-xs font-medium font-inter text-secondary-400 tracking-[-0.12px] leading-[1.4]">
            Digite seu email e senha para entrar
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1">
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
            <div className="text-right">
              <Link
                href="/recuperar-senha"
                className="text-xs font-semibold font-inter text-info tracking-[-0.12px] leading-snug"
              >
                Esqueceu a senha?
              </Link>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center -mt-2">{error}</p>
          )}

          <div className="flex flex-col gap-6">
            <Button type="submit" loading={loading}>
              Entrar
            </Button>

            {/* Divisor */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-secondary-100" />
              <span className="text-xs font-normal font-inter text-secondary-400 tracking-[-0.12px]">
                Ou
              </span>
              <div className="flex-1 h-px bg-secondary-100" />
            </div>

            {/* Botões sociais */}
            <div className="flex flex-col gap-[15px]">
              <Button
                type="button"
                variant="social"
                icon={<GoogleIcon />}
                onClick={() => {}}
              >
                Continuar com Google
              </Button>
              <Button
                type="button"
                variant="social"
                icon={<FacebookIcon />}
                onClick={() => {}}
              >
                Continuar com Facebook
              </Button>
            </div>
          </div>

          {/* Link de cadastro */}
          <div className="flex items-center justify-center gap-1.5 mt-auto pt-4">
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
    </MobileScreen>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#1877F2"/>
      <path d="M12.375 11.625l.375-2.438h-2.344V7.5c0-.666.327-1.313 1.376-1.313H12.9V4.078S12.023 3.938 11.184 3.938c-1.932 0-3.196 1.171-3.196 3.29v1.959H5.836v2.438h2.152V18a9.06 9.06 0 002.793 0v-6.375h2.594z" fill="white"/>
    </svg>
  );
}
