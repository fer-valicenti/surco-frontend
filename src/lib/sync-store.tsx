import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";

export type EstrategiaResolucion = "servidor" | "cliente";
export type OperacionSync = "create" | "update" | "delete";

export interface SyncConflicto {
  id: string;
  tabla: string;
  registroId: string;
  operacion: OperacionSync;
  usuario: string;
  deviceId: string | null;
  versionCliente: number;
  versionServidor: number;
  payloadCliente: Record<string, unknown> | null;
  fecha: string;
}

interface UsuarioApi {
  nombre: string;
}

interface ConflictoApi {
  id: string;
  tabla: string;
  registroId: string;
  operacion: OperacionSync;
  usuario: UsuarioApi;
  deviceId: string | null;
  versionCliente: number;
  versionServidor: number;
  payloadCliente: Record<string, unknown> | null;
  createdAt: string;
}

const conflictoDesdeApi = (c: ConflictoApi): SyncConflicto => ({
  id: c.id,
  tabla: c.tabla,
  registroId: c.registroId,
  operacion: c.operacion,
  usuario: c.usuario.nombre,
  deviceId: c.deviceId,
  versionCliente: c.versionCliente,
  versionServidor: c.versionServidor,
  payloadCliente: c.payloadCliente,
  fecha: c.createdAt,
});

interface SyncContextValue {
  conflictos: SyncConflicto[];
  cargando: boolean;
  resolver: (id: string, estrategia: EstrategiaResolucion) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * Conflictos reales contra /sync/conflictos (solo propietario/agrónomo,
 * ver ROLES_GESTION_CONFLICTOS en el backend — un 403 acá simplemente
 * deja la bandeja vacía). El servidor no guarda una foto de su propio
 * estado en el conflicto, solo versionServidor + el payloadCliente que
 * perdió la carrera — no hay diff campo a campo como en el mock, se
 * muestra la versión y el payload que "usar dispositivo" pisaría.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { establecimiento } = useAuth();
  const [conflictos, setConflictos] = useState<SyncConflicto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!establecimiento) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    api
      .get<ConflictoApi[]>("/sync/conflictos", { establecimientoId: establecimiento.id })
      .then((r) => {
        if (!cancelado) setConflictos(r.map(conflictoDesdeApi));
      })
      .catch(() => {
        if (!cancelado) setConflictos([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [establecimiento]);

  const resolver: SyncContextValue["resolver"] = async (id, estrategia) => {
    await api.post(`/sync/conflictos/${id}/resolver`, { estrategia });
    setConflictos((prev) => prev.filter((c) => c.id !== id));
  };

  return <SyncContext.Provider value={{ conflictos, cargando, resolver }}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync tiene que usarse dentro de <SyncProvider>");
  return ctx;
}
