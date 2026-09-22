"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "social" | "ghost";
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  fullWidth = true,
  icon,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "flex items-center justify-center gap-2.5 h-12 px-6 rounded-[10px] text-sm font-medium font-inter tracking-[-0.14px] leading-snug transition-all duration-200 active:scale-[0.98] select-none";

  const variants = {
    primary:
      "btn-primary-gradient btn-primary-shadow border border-white text-white disabled:opacity-60",
    social:
      "bg-white border border-[#EFF0F6] btn-social-shadow text-secondary-500 font-semibold",
    ghost:
      "bg-transparent text-primary border border-primary hover:bg-primary-50",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
