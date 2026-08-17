import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, alSesionInvalida, guardarTokens, leerTokens, limpiarTokens, type Tokens } from "@/lib/api-client";
import type { Rol } from "@/lib/surco-data";

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  emailVerificadoEn: string | null;
}

export interface EstablecimientoActual {
  id: string;
  nombre: string;
  provincia: string | null;
  partido: string | null;
  rol: Rol;
}

type ResultadoAuth = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  usuario: UsuarioSesion | null;
  establecimiento: EstablecimientoActual | null;
  autenticado: boolean;
  cargando: boolean;
  login: (email: string, password: string, recordar: boolean) => Promise<ResultadoAuth>;
  registrar: (nombre: string, email: string, password: string, recordar: boolean) => Promise<ResultadoAuth>;
  logout: () => void;
  recargarEstablecimiento: () => Promise<void>;
  solicitarRecuperacion: (email: string) => Promise<ResultadoAuth>;
  restablecerPassword: (token: string, nuevaPassword: string) => Promise<ResultadoAuth>;
  verificarEmail: (token: string) => Promise<ResultadoAuth>;
  reenviarVerificacion: () => Promise<ResultadoAuth>;
}

// Centraliza el caso 429 — @nestjs/throttler en el backend (ver
// CLAUDE.md §13 del backend) responde igual para login/register/
// forgot-password/resend-verification, así que todos los métodos de
// este store reusan el mismo mensaje amigable.
function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError && e.status === 429) {
    return "Demasiados intentos. Esperá un minuto e intentá de nuevo.";
  }
  return e instanceof ApiError ? e.message : "No se pudo conectar con el servidor";
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface RespuestaAuth extends Tokens {
  usuario: UsuarioSesion;
}

/**
 * Sesión real contra el backend (JWT access + refresh token, ver
 * auth.controller.ts). Al montar, si hay tokens guardados, valida contra
 * /auth/me y trae el establecimiento del usuario — así una recarga de
 * página no te manda de vuelta al login mientras el token siga vivo.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [establecimiento, setEstablecimiento] = useState<EstablecimientoActual | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarEstablecimiento = async () => {
    try {
      const lista = await api.get<EstablecimientoActual[]>("/establecimientos");
      setEstablecimiento(lista[0] ?? null);
    } catch {
      setEstablecimiento(null);
    }
  };

  useEffect(() => {
    alSesionInvalida(() => {
      setUsuario(null);
      setEstablecimiento(null);
    });

    const tokens = leerTokens();
    if (!tokens) {
      setCargando(false);
      return;
    }
    (async () => {
      try {
        const me = await api.get<UsuarioSesion>("/auth/me");
        setUsuario(me);
        await cargarEstablecimiento();
      } catch {
        limpiarTokens();
        setUsuario(null);
      } finally {
        setCargando(false);
      }
    })();

    return () => alSesionInvalida(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login: AuthContextValue["login"] = async (email, password, recordar) => {
    try {
      const res = await api.post<RespuestaAuth>("/auth/login", { email, password }, { sinAuth: true });
      guardarTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken }, recordar);
      setUsuario(res.usuario);
      await cargarEstablecimiento();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  };

  const registrar: AuthContextValue["registrar"] = async (nombre, email, password, recordar) => {
    try {
      const res = await api.post<RespuestaAuth>("/auth/register", { nombre, email, password }, { sinAuth: true });
      guardarTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken }, recordar);
      setUsuario(res.usuario);
      await cargarEstablecimiento();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  };

  const solicitarRecuperacion: AuthContextValue["solicitarRecuperacion"] = async (email) => {
    try {
      await api.post("/auth/forgot-password", { email }, { sinAuth: true });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  };

  const restablecerPassword: AuthContextValue["restablecerPassword"] = async (token, nuevaPassword) => {
    try {
      await api.post("/auth/reset-password", { token, nuevaPassword }, { sinAuth: true });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  };

  const verificarEmail: AuthContextValue["verificarEmail"] = async (token) => {
    try {
      await api.post("/auth/verify-email", { token }, { sinAuth: true });
      // Si ya había sesión activa en esta pestaña, refresca el flag sin
      // recargar la página — así el banner desaparece solo.
      if (usuario) {
        const me = await api.get<UsuarioSesion>("/auth/me");
        setUsuario(me);
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  };

  const reenviarVerificacion: AuthContextValue["reenviarVerificacion"] = async () => {
    try {
      await api.post("/auth/resend-verification");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeDeError(e) };
    }
  };

  const logout = () => {
    const tokens = leerTokens();
    limpiarTokens();
    setUsuario(null);
    setEstablecimiento(null);
    if (tokens) {
      api.post("/auth/logout", { refreshToken: tokens.refreshToken }, { sinAuth: true }).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        establecimiento,
        autenticado: usuario !== null,
        cargando,
        login,
        registrar,
        logout,
        recargarEstablecimiento: cargarEstablecimiento,
        solicitarRecuperacion,
        restablecerPassword,
        verificarEmail,
        reenviarVerificacion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth tiene que usarse dentro de <AuthProvider>");
  return ctx;
}
