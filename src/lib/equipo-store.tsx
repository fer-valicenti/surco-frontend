import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { puedeGestionar, type Rol } from "@/lib/surco-data";

export interface Miembro {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export type EstadoInvitacion = "pendiente" | "aceptada" | "revocada" | "expirada";

export interface Invitacion {
  id: string;
  email: string;
  rol: Rol;
  estado: EstadoInvitacion;
  fecha: string;
  invitadoPor: string;
}

interface UsuarioApi {
  id: string;
  nombre: string;
  email: string;
}

interface MiembroApi {
  usuarioId: string;
  rol: Rol;
  usuario: UsuarioApi;
}

const miembroDesdeApi = (m: MiembroApi): Miembro => ({
  id: m.usuarioId,
  nombre: m.usuario.nombre,
  email: m.usuario.email,
  rol: m.rol,
});

interface InvitacionApi {
  id: string;
  email: string;
  rolPendiente: Rol;
  estado: EstadoInvitacion;
  createdAt: string;
  invitador: UsuarioApi;
}

const invitacionDesdeApi = (i: InvitacionApi): Invitacion => ({
  id: i.id,
  email: i.email,
  rol: i.rolPendiente,
  estado: i.estado,
  fecha: i.createdAt,
  invitadoPor: i.invitador.nombre,
});

interface EquipoContextValue {
  miembros: Miembro[];
  invitaciones: Invitacion[];
  cargando: boolean;
  invitar: (email: string, rol: Rol) => Promise<void>;
  revocar: (id: string) => Promise<void>;
  removerMiembro: (usuarioId: string) => Promise<void>;
}

const EquipoContext = createContext<EquipoContextValue | null>(null);

/**
 * Equipo real contra /establecimientos/:id/usuarios (miembros actuales,
 * abierto a los 3 roles) e /establecimientos/:id/invitaciones (solo
 * propietario/agrónomo, 403 para operario). Se piden por separado —no en
 * un solo Promise.all— porque si un operario los pidiera juntos, el 403
 * esperado de invitaciones tiraría abajo también la lista de miembros
 * que sí puede ver. Invitar y revocar no traen la relación `invitador`
 * en su respuesta (el service no la carga al crear ni al revocar la
 * fila) — se refetchea la lista completa después de cada acción en vez
 * de remapear una respuesta incompleta.
 */
export function EquipoProvider({ children }: { children: ReactNode }) {
  const { establecimiento } = useAuth();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!establecimiento) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);

    api
      .get<MiembroApi[]>(`/establecimientos/${establecimiento.id}/usuarios`)
      .then((lista) => {
        if (!cancelado) setMiembros(lista.map(miembroDesdeApi));
      })
      .catch(() => {
        if (!cancelado) setMiembros([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    if (puedeGestionar(establecimiento.rol)) {
      api
        .get<InvitacionApi[]>(`/establecimientos/${establecimiento.id}/invitaciones`)
        .then((lista) => {
          if (!cancelado) setInvitaciones(lista.map(invitacionDesdeApi));
        })
        .catch(() => {
          if (!cancelado) setInvitaciones([]);
        });
    } else {
      setInvitaciones([]);
    }

    return () => {
      cancelado = true;
    };
  }, [establecimiento]);

  const invitar: EquipoContextValue["invitar"] = async (email, rol) => {
    await api.post(`/establecimientos/${establecimiento!.id}/invitaciones`, {
      email,
      rolPendiente: rol,
    });
    const lista = await api.get<InvitacionApi[]>(`/establecimientos/${establecimiento!.id}/invitaciones`);
    setInvitaciones(lista.map(invitacionDesdeApi));
  };

  const revocar: EquipoContextValue["revocar"] = async (id) => {
    await api.post(`/establecimientos/${establecimiento!.id}/invitaciones/${id}/revocar`);
    const lista = await api.get<InvitacionApi[]>(`/establecimientos/${establecimiento!.id}/invitaciones`);
    setInvitaciones(lista.map(invitacionDesdeApi));
  };

  const removerMiembro: EquipoContextValue["removerMiembro"] = async (usuarioId) => {
    await api.delete(`/establecimientos/${establecimiento!.id}/usuarios/${usuarioId}`);
    setMiembros((prev) => prev.filter((m) => m.id !== usuarioId));
  };

  return (
    <EquipoContext.Provider value={{ miembros, invitaciones, cargando, invitar, revocar, removerMiembro }}>
      {children}
    </EquipoContext.Provider>
  );
}

export function useEquipo() {
  const ctx = useContext(EquipoContext);
  if (!ctx) throw new Error("useEquipo tiene que usarse dentro de <EquipoProvider>");
  return ctx;
}
