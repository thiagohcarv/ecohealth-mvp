const TOKEN_KEY = "eco_token";
const USER_KEY = "eco_user";
const PENDING_EMAIL_KEY = "eco_pending_email";

export interface StoredUser {
  userId: string;
  nome: string;
  crm?: string;
}

// ─── Token ────────────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PENDING_EMAIL_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── Usuário ──────────────────────────────────────────────────────────────────

export function setUser(user: StoredUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

// ─── Email pendente (cadastro → verificar) ────────────────────────────────────

export function setPendingEmail(email: string): void {
  localStorage.setItem(PENDING_EMAIL_KEY, email);
}

export function getPendingEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PENDING_EMAIL_KEY);
}

export function clearPendingEmail(): void {
  localStorage.removeItem(PENDING_EMAIL_KEY);
}

// ─── Guard: redireciona se não autenticado ────────────────────────────────────

export function requireAuth(): boolean {
  if (typeof window === "undefined") return false;
  if (!isAuthenticated()) {
    window.location.replace("/login");
    return false;
  }
  return true;
}
