const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "aulaflow_token";
const LEGACY_TOKEN_KEY = "aulapro_token";
export const AUTH_UNAUTHORIZED_EVENT = "aulaflow:unauthorized";

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = sessionToken.get();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = (await response
    .json()
    .catch(() => ({ message: "Respuesta inválida" }))) as ApiResponse<T>;

  if (!response.ok) {
    if (response.status === 401 && token) {
      sessionToken.clear();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      body.message ?? "No se pudo completar la solicitud",
      response.status,
    );
  }
  return body;
}

export const sessionToken = {
  get: () =>
    localStorage.getItem(TOKEN_KEY) ??
    sessionStorage.getItem(TOKEN_KEY) ??
    localStorage.getItem(LEGACY_TOKEN_KEY) ??
    sessionStorage.getItem(LEGACY_TOKEN_KEY),
  set: (token: string, remember = false) => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  },
};
