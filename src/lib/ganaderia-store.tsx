import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import type { EventoSanitario, MovimientoStock, Rodeo, RotacionPotrero, TipoMovimiento } from "@/lib/surco-data";

interface RodeoApi {
  id: string;
  nombre: string;
  categoriaId: string | null;
  categoriaSugerida: string | null;
  pendienteRevision: boolean;
  cantidadCabezas: number;
  potreroActualId: string | null;
  version: number;
}

interface MovimientoApi {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  fecha: string;
  motivo: string | null;
}

interface RotacionApi {
  id: string;
  potreroId: string;
  fechaIngreso: string;
}

interface MoverAPotreroRespuesta {
  rodeo: RodeoApi;
  cargaResultanteEvHa: number | null;
  advertenciaSobrepastoreo: boolean;
}

interface EventoSanitarioApi {
  id: string;
  rodeoId: string;
  tipo: EventoSanitario["tipo"];
  producto: string;
  fecha: string;
  proximoRefuerzo: string | null;
}

const eventoDesdeApi = (e: EventoSanitarioApi): EventoSanitario => ({
  id: e.id,
  rodeoId: e.rodeoId,
  tipo: e.tipo,
  producto: e.producto,
  fecha: e.fecha,
  proximoRefuerzo: e.proximoRefuerzo,
});

const rodeoDesdeApi = (r: RodeoApi): Rodeo => ({
  id: r.id,
  nombre: r.nombre,
  categoriaId: r.categoriaId,
  categoriaSugerida: r.categoriaSugerida,
  pendienteRevision: r.pendienteRevision,
  cantidadCabezas: r.cantidadCabezas,
  potreroId: r.potreroActualId,
  sync: "sincronizado",
  version: r.version,
});

/**
 * El backend guarda una fila por estadía (potrero + fecha de ingreso/egreso),
 * no un evento "origen → destino" — se reconstruye acá comparando cada fila
 * con la anterior en orden cronológico, igual que lo hacía el mock.
 */
function rotacionesDesdeApi(rotaciones: RotacionApi[]): RotacionPotrero[] {
  const asc = [...rotaciones].sort((a, b) => a.fechaIngreso.localeCompare(b.fechaIngreso));
  return asc.map((r, i) => ({
    id: r.id,
    potreroOrigenId: i > 0 ? asc[i - 1]!.potreroId : null,
    potreroDestinoId: r.potreroId,
    fecha: r.fechaIngreso,
  }));
}

interface GanaderiaContextValue {
  rodeos: Rodeo[];
  eventosSanitarios: EventoSanitario[];
  cargando: boolean;
  movimientosDe: (rodeoId: string) => MovimientoStock[];
  rotacionesDe: (rodeoId: string) => RotacionPotrero[];
  registrarMovimiento: (rodeoId: string, tipo: TipoMovimiento, cantidad: number, motivo: string) => Promise<void>;
  moverRodeo: (
    rodeoId: string,
    potreroDestinoId: string,
  ) => Promise<{ cargaResultanteEvHa: number | null; advertenciaSobrepastoreo: boolean }>;
  crearRodeo: (nombre: string, categoriaId: string) => Promise<Rodeo>;
  crearEventoSanitario: (
    rodeoId: string,
    tipo: EventoSanitario["tipo"],
    producto: string,
    proximoRefuerzo: string | null,
  ) => Promise<void>;
}

const GanaderiaContext = createContext<GanaderiaContextValue | null>(null);

/**
 * Rodeos reales contra /rodeos. Los movimientos no tienen alta REST propia
 * — van por /sync/push genérico (ver entity-registry.ts) — así que
 * registrarMovimiento empuja el cambio ahí y después vuelve a pedir el
 * rodeo (cantidadCabezas la deriva un trigger, no viene en la respuesta
 * del push).
 */
export function GanaderiaProvider({ children }: { children: ReactNode }) {
  const { establecimiento } = useAuth();
  const [rodeos, setRodeos] = useState<Rodeo[]>([]);
  const [movimientos, setMovimientos] = useState<Record<string, MovimientoStock[]>>({});
  const [rotaciones, setRotaciones] = useState<Record<string, RotacionPotrero[]>>({});
  const [eventosSanitarios, setEventosSanitarios] = useState<EventoSanitario[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!establecimiento) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    api
      .get<RodeoApi[]>("/rodeos", { establecimientoId: establecimiento.id })
      .then(async (lista) => {
        if (cancelado) return;
        setRodeos(lista.map(rodeoDesdeApi));
        const [movs, rots, eventos] = await Promise.all([
          Promise.all(lista.map((r) => api.get<MovimientoApi[]>(`/rodeos/${r.id}/movimientos`))),
          Promise.all(lista.map((r) => api.get<RotacionApi[]>(`/rodeos/${r.id}/rotaciones`))),
          Promise.all(lista.map((r) => api.get<EventoSanitarioApi[]>("/eventos-sanitarios", { rodeoId: r.id }))),
        ]);
        if (cancelado) return;
        setMovimientos(Object.fromEntries(lista.map((r, i) => [r.id, movs[i]!])));
        setRotaciones(Object.fromEntries(lista.map((r, i) => [r.id, rotacionesDesdeApi(rots[i]!)])));
        setEventosSanitarios(eventos.flat().map(eventoDesdeApi));
      })
      .catch(() => {
        if (!cancelado) {
          setRodeos([]);
          setMovimientos({});
          setRotaciones({});
          setEventosSanitarios([]);
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [establecimiento]);

  const movimientosDe: GanaderiaContextValue["movimientosDe"] = (rodeoId) => movimientos[rodeoId] ?? [];
  const rotacionesDe: GanaderiaContextValue["rotacionesDe"] = (rodeoId) => rotaciones[rodeoId] ?? [];

  const registrarMovimiento: GanaderiaContextValue["registrarMovimiento"] = async (
    rodeoId,
    tipo,
    cantidad,
    motivo,
  ) => {
    await api.post("/sync/push", {
      changes: [
        {
          id: crypto.randomUUID(),
          tabla: "movimientos_stock",
          operacion: "create",
          version: 1,
          payload: {
            establecimientoId: establecimiento!.id,
            rodeoId,
            tipo,
            cantidad,
            fecha: new Date().toISOString(),
            motivo: motivo.trim() || null,
          },
        },
      ],
    });
    const [lista, movs] = await Promise.all([
      api.get<RodeoApi[]>("/rodeos", { establecimientoId: establecimiento!.id }),
      api.get<MovimientoApi[]>(`/rodeos/${rodeoId}/movimientos`),
    ]);
    setRodeos(lista.map(rodeoDesdeApi));
    setMovimientos((prev) => ({ ...prev, [rodeoId]: movs }));
  };

  const moverRodeo: GanaderiaContextValue["moverRodeo"] = async (rodeoId, potreroDestinoId) => {
    const rodeo = rodeos.find((r) => r.id === rodeoId);
    if (!rodeo) throw new Error("Rodeo no encontrado");
    const resultado = await api.post<MoverAPotreroRespuesta>(`/rodeos/${rodeoId}/mover-a-potrero`, {
      potreroId: potreroDestinoId,
      version: rodeo.version,
    });
    const mapeado = rodeoDesdeApi(resultado.rodeo);
    setRodeos((prev) => prev.map((r) => (r.id === rodeoId ? mapeado : r)));
    const rots = await api.get<RotacionApi[]>(`/rodeos/${rodeoId}/rotaciones`);
    setRotaciones((prev) => ({ ...prev, [rodeoId]: rotacionesDesdeApi(rots) }));
    return {
      cargaResultanteEvHa: resultado.cargaResultanteEvHa,
      advertenciaSobrepastoreo: resultado.advertenciaSobrepastoreo,
    };
  };

  const crearEventoSanitario: GanaderiaContextValue["crearEventoSanitario"] = async (
    rodeoId,
    tipo,
    producto,
    proximoRefuerzo,
  ) => {
    await api.post("/sync/push", {
      changes: [
        {
          id: crypto.randomUUID(),
          tabla: "eventos_sanitarios",
          operacion: "create",
          version: 1,
          payload: {
            establecimientoId: establecimiento!.id,
            rodeoId,
            tipo,
            producto: producto.trim(),
            fecha: new Date().toISOString(),
            proximoRefuerzo,
          },
        },
      ],
    });
    const eventos = await api.get<EventoSanitarioApi[]>("/eventos-sanitarios", { rodeoId });
    setEventosSanitarios((prev) => [...prev.filter((e) => e.rodeoId !== rodeoId), ...eventos.map(eventoDesdeApi)]);
  };

  const crearRodeo: GanaderiaContextValue["crearRodeo"] = async (nombre, categoriaId) => {
    const creado = await api.post<RodeoApi>("/rodeos", {
      establecimientoId: establecimiento!.id,
      nombre,
      categoriaId,
    });
    const mapeado = rodeoDesdeApi(creado);
    setRodeos((prev) => [...prev, mapeado]);
    return mapeado;
  };

  return (
    <GanaderiaContext.Provider
      value={{
        rodeos,
        eventosSanitarios,
        cargando,
        movimientosDe,
        rotacionesDe,
        registrarMovimiento,
        moverRodeo,
        crearRodeo,
        crearEventoSanitario,
      }}
    >
      {children}
    </GanaderiaContext.Provider>
  );
}

export function useGanaderia() {
  const ctx = useContext(GanaderiaContext);
  if (!ctx) throw new Error("useGanaderia tiene que usarse dentro de <GanaderiaProvider>");
  return ctx;
}
