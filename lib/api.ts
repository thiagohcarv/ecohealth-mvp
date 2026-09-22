const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
  error?: never;
  code?: never;
}

export interface ApiError {
  data?: never;
  error: string;
  code: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

// ─── Cliente ──────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("eco_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, headers });
    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      return {
        error: (json["error"] as string) ?? "Erro desconhecido",
        code: (json["code"] as string) ?? "UNKNOWN_ERROR",
      };
    }

    return { data: json as T };
  } catch {
    return { error: "Sem conexão com o servidor", code: "NETWORK_ERROR" };
  }
}

async function requestFormData<T>(path: string, formData: FormData, method = "PATCH"): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Não definir Content-Type — browser define automaticamente com boundary

  try {
    const res = await fetch(`${API_URL}${path}`, { method, headers, body: formData });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return {
        error: (json["error"] as string) ?? "Erro desconhecido",
        code: (json["code"] as string) ?? "UNKNOWN_ERROR",
      };
    }
    return { data: json as T };
  } catch {
    return { error: "Sem conexão com o servidor", code: "NETWORK_ERROR" };
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  patchForm: <T>(path: string, formData: FormData) =>
    requestFormData<T>(path, formData, "PATCH"),
};

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export interface AuthResponse {
  success: boolean;
  token?: string;
  userId?: string;
  nome?: string;
  crm?: string;
  message?: string;
}

export interface ConsultationListResponse {
  success: boolean;
  consultations: ConsultationItem[];
  total: number;
}

export interface ConsultationItem {
  id: string;
  date: string;
  status: "PENDING" | "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  chiefComplaint: string | null;
  patient: { id: string; name: string; cpf: string | null };
  soapNote: { id: string; assessment: string; icd10Codes: string[] } | null;
  audioRecording: { durationSec: number | null } | null;
}

export interface MeResponse {
  success: boolean;
  user: { id: string; email: string; name: string; crm: string; isVerified: boolean };
}
