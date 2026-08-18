// Cliente HTTP contra el backend real (surco-backend, NestJS). Maneja
// almacenamiento de tokens, adjunta el Authorization header, y reintenta
// una vez con refresh token ante un 401 antes de rendirse.

export const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/v1";
const STORAGE_KEY = "surco.tokens";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

function leerStorage(): Storage {
  return localStorage.getItem(STORAGE_KEY) !== null ? localStorage : sessionStorage;
}

export function leerTokens(): Tokens | null {
  const cruda = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
  if (!cruda) return null;
  try {
    return JSON.parse(cruda) as Tokens;
  } catch {
    return null;
  }
}

export function guardarTokens(tokens: Tokens, recordar: boolean) {
  const payload = JSON.stringify(tokens);
  if (recordar) {
    localStorage.setItem(STORAGE_KEY, payload);
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    sessionStorage.setItem(STORAGE_KEY, payload);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function limpiarTokens() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizarMensaje(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(" · ");
    if (typeof m === "string") return m;
  }
  return fallback;
}

/** Se llama cuando ni el access token ni el refresh sirven — auth-store se suscribe para forzar logout. */
let onSesionInvalida: (() => void) | null = null;
export function alSesionInvalida(cb: (() => void) | null) {
  onSesionInvalida = cb;
}

let refrescoEnCurso: Promise<string | null> | null = null;

async function refrescarAccessToken(): Promise<string | null> {
  const tokens = leerTokens();
  if (!tokens) return null;
  if (!refrescoEnCurso) {
    refrescoEnCurso = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        if (!res.ok) return null;
        const nuevos = (await res.json()) as Tokens;
        const recordar = leerStorage() === localStorage;
        guardarTokens(nuevos, recordar);
        return nuevos.accessToken;
      } catch {
        return null;
      } finally {
        refrescoEnCurso = null;
      }
    })();
  }
  return refrescoEnCurso;
}

interface Opciones {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Evita el reintento con refresh — usado por el propio /auth/refresh y /auth/login. */
  sinAuth?: boolean;
}

function construirUrl(path: string, params?: Opciones["params"]) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function ejecutar<T>(path: string, opciones: Opciones, tokenOverride?: string): Promise<T> {
  const tokens = leerTokens();
  const token = tokenOverride ?? tokens?.accessToken;
  // FormData (subida de fotos, ver ScoutingProvider): el browser arma el
  // Content-Type con el boundary del multipart solo — si lo seteamos acá
  // a mano queda sin boundary y el backend no puede parsear el body.
  const esFormData = opciones.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!esFormData) headers["Content-Type"] = "application/json";
  if (token && !opciones.sinAuth) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(construirUrl(path, opciones.params), {
    method: opciones.method ?? "GET",
    headers,
    body: opciones.body === undefined ? undefined : esFormData ? (opciones.body as FormData) : JSON.stringify(opciones.body),
  });

  if (res.status === 401 && !opciones.sinAuth && tokens) {
    const nuevoToken = await refrescarAccessToken();
    if (nuevoToken) {
      return ejecutar<T>(path, opciones, nuevoToken);
    }
    limpiarTokens();
    onSesionInvalida?.();
    throw new ApiError(401, "Sesión vencida — iniciá sesión de nuevo");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, normalizarMensaje(body, `Error ${res.status}`));
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, params?: Opciones["params"]) => ejecutar<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown, opciones?: Partial<Opciones>) =>
    ejecutar<T>(path, { method: "POST", body, ...opciones }),
  patch: <T>(path: string, body?: unknown) => ejecutar<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => ejecutar<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => ejecutar<T>(path, { method: "DELETE" }),
};
