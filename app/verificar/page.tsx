"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { api, type AuthResponse } from "@/lib/api";
import { setToken, setUser, getPendingEmail, clearPendingEmail } from "@/lib/auth";

const DIGITS = 6;

export default function VerificarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(DIGITS).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const pending = getPendingEmail();
    if (pending) setEmail(pending);
    refs.current[0]?.focus();
  }, []);

  function handleDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < DIGITS - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (digits.some((d) => !d)) {
      setError("Digite todos os 6 dígitos.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await api.post<AuthResponse>("/api/auth/verify-otp", {
      email,
      otp: digits.join(""),
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
      clearPendingEmail();

      if (typeof window !== "undefined" && localStorage.getItem("eco_lgpd_pending")) {
        await api.post("/api/auth/lgpd-consent", {});
        localStorage.removeItem("eco_lgpd_pending");
      }

      router.push("/dashboard");
    }
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    setResendMsg("");
    const result = await api.post<{ success: boolean; message: string }>("/api/auth/refresh-otp", { email });
    setResending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setResendMsg("Novo código enviado!");
      setDigits(Array(DIGITS).fill(""));
      refs.current[0]?.focus();
    }
  }

  return (
    <MobileScreen>
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center px-[37px] pt-[75px] pb-4">
          <Link href="/cadastro" className="text-secondary-500 hover:text-secondary-400 transition-colors" aria-label="Voltar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>

        <div className="px-[40px] flex flex-col animate-fade-in">
          {/* Ícone */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2260FF" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
          </div>

          {/* Título */}
          <div className="flex flex-col gap-3 mb-8 text-center">
            <h1 className="font-inter font-bold text-[32px] text-secondary-500 tracking-[-0.64px] leading-[1.3]">
              Verifique sua conta!
            </h1>
            <p className="text-xs font-medium font-inter text-secondary-400 tracking-[-0.12px] leading-[1.4] w-[300px] mx-auto">
              Encaminhamos um código para
              {email ? <span className="font-semibold text-secondary-500"> {email}</span> : " o seu email"}.
            </p>
            {/* Alpha hint */}
            <p className="text-[10px] text-secondary-300 italic">Alpha: use o código <strong>123456</strong></p>
          </div>

          {/* OTP inputs */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex justify-between gap-2">
              {digits.map((digit, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <input
                    ref={(el) => { refs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-full text-center text-xl font-bold font-inter text-secondary-500 bg-transparent outline-none py-1"
                    maxLength={1}
                    aria-label={`Dígito ${i + 1}`}
                  />
                  <div className={`h-0.5 w-full rounded-full transition-colors ${digit ? "bg-primary" : "bg-secondary-100"}`} />
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            {resendMsg && <p className="text-xs text-green-600 text-center">{resendMsg}</p>}

            <Button type="submit" loading={loading}>
              Verificar
            </Button>

            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xs font-medium font-inter text-secondary-400">
                Não recebeu?
              </span>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-xs font-semibold font-inter text-info disabled:opacity-50"
              >
                {resending ? "Enviando..." : "Reenviar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </MobileScreen>
  );
}
