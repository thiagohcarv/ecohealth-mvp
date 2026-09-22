"use client";

import { useState } from "react";

type SignState = "idle" | "loading" | "success" | "error";

interface SignButtonProps {
  consultationId: string;
  onSigned?: (signedAt: Date) => void;
}

export function SignButton({ consultationId, onSigned }: SignButtonProps) {
  const [state, setState] = useState<SignState>("idle");
  const [toast, setToast] = useState(false);

  async function handleSign() {
    setState("loading");
    try {
      const token = localStorage.getItem("eco_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/consultations/${consultationId}/sign`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Erro ao assinar");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      a.href = url;
      a.download = match?.[1] ?? `EcoHealth_consulta_${consultationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setState("success");
      setToast(true);
      onSigned?.(new Date());
      setTimeout(() => setToast(false), 4000);
    } catch (err) {
      console.error("sign error:", err);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#1A1C1E] text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-fade-in z-50">
          <svg className="w-3.5 h-3.5 text-[#22C55E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Consulta assinada digitalmente!
        </div>
      )}

      {state === "success" ? (
        <div className="w-full h-12 rounded-3xl bg-[#22C55E]/10 border border-[#22C55E] text-[#16A34A] text-sm font-semibold font-inter flex items-center justify-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Assinado ICP-Brasil
        </div>
      ) : (
        <button
          onClick={handleSign}
          disabled={state === "loading"}
          className="w-full h-12 rounded-3xl border border-[#2260FF] text-[#2260FF] text-sm font-medium font-inter flex items-center justify-center gap-2 transition-all disabled:opacity-60 hover:bg-[#2260FF]/5 active:scale-[0.98]"
        >
          {state === "loading" ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Gerando PDF...
            </>
          ) : state === "error" ? (
            <>
              <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="text-red-500">Erro ao assinar</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Assinar nota
            </>
          )}
        </button>
      )}
    </div>
  );
}

interface SignedBadgeProps {
  signedAt?: Date | string | null;
}

export function SignedBadge({ signedAt }: SignedBadgeProps) {
  if (!signedAt) return null;
  const dt = signedAt instanceof Date ? signedAt : new Date(signedAt);
  return (
    <div className="flex items-center gap-1.5 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-full px-3 py-1">
      <svg className="w-3 h-3 text-[#16A34A] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="text-[10px] font-semibold text-[#16A34A]">
        Assinado ICP-Brasil · {dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
