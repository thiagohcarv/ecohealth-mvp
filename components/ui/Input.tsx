"use client";

import { InputHTMLAttributes, ReactNode, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  rightIcon?: ReactNode;
}

export function Input({ label, error, rightIcon, type, className = "", ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-center h-[21px] rounded-full">
        <span className="text-xs font-medium font-jakarta text-secondary-400 tracking-[-0.24px] leading-relaxed">
          {label}
        </span>
      </div>
      <div
        className={`relative flex items-center bg-white border rounded-[10px] input-shadow h-[46px] px-3.5 gap-3 ${
          error ? "border-red-400" : "border-secondary-100"
        } ${className}`}
      >
        <input
          type={inputType}
          className="flex-1 text-sm font-medium font-inter text-secondary-500 tracking-[-0.14px] leading-snug bg-transparent outline-none placeholder:text-secondary-300 min-w-0"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="shrink-0 text-secondary-400 hover:text-secondary-500 transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        )}
        {!isPassword && rightIcon && <div className="shrink-0 text-secondary-400">{rightIcon}</div>}
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5 px-1">{error}</p>}
    </div>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
