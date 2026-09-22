"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EcoHealthLogo } from "@/components/EcoHealthLogo";
import { clearAuth, getUser, type StoredUser } from "@/lib/auth";

// Páginas sem sidebar (autenticação / públicas)
const PUBLIC_PATHS = ["/", "/login", "/cadastro", "/verificar", "/lgpd"];

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "white" : "none"} stroke={active ? "white" : "currentColor"} strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/nova-consulta",
    label: "Nova Consulta",
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "white" : "currentColor"} strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    href: "/historico",
    label: "Histórico",
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "white" : "currentColor"} strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? "white" : "none"} stroke={active ? "white" : "currentColor"} strokeWidth="2">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "white" : "currentColor"} strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

function DocAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

export function DesktopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!isPublic) setUser(getUser());
  }, [pathname, isPublic]);

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <div className={isPublic ? "" : "lg:flex lg:min-h-screen"}>
      {/* Sidebar — apenas desktop, apenas páginas autenticadas */}
      {!isPublic && (
        <aside className="hidden lg:flex flex-col fixed top-0 left-0 w-60 h-screen bg-white border-r border-secondary-100 z-40">
          {/* Logo */}
          <div className="px-6 py-5 border-b border-secondary-100">
            <EcoHealthLogo size="md" />
          </div>

          {/* Navegação */}
          <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "text-secondary-400 hover:bg-secondary-100 hover:text-secondary-500"
                  }`}
                >
                  <span className="shrink-0">{item.icon(active)}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Rodapé da sidebar */}
          <div className="border-t border-secondary-100 p-4 flex flex-col gap-3">
            {/* Badge de plano */}
            <div>
              <span className="inline-flex items-center gap-1.5 bg-primary-50 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Trial
              </span>
            </div>

            {/* Avatar + nome + logout */}
            <div className="flex items-center gap-2.5">
              <DocAvatar name={user?.nome ?? "Dr"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-500 truncate">
                  {user?.nome ?? "Médico"}
                </p>
                {user?.crm && (
                  <p className="text-xs text-secondary-400">CRM {user.crm}</p>
                )}
              </div>
              <button
                onClick={handleLogout}
                title="Sair"
                className="p-1.5 rounded-lg text-secondary-300 hover:text-secondary-500 hover:bg-secondary-100 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Conteúdo principal */}
      <div className={isPublic ? "" : "lg:ml-60 flex-1 min-w-0 lg:min-h-screen"}>
        {children}
      </div>
    </div>
  );
}
