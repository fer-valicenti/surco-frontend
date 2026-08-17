import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useLotes } from "@/lib/lotes-store";
import type { EstadoOrden, HistorialEstado, OrdenInsumo, OrdenTrabajo, TipoLabor } from "@/lib/surco-data";

export type NuevaOrden = {
  loteId: string;
  tipoLabor: TipoLabor;
  insumos: { insumoId: string; cantidad: number; unidad: string }[];
};

interface OrdenInsumoApi {
  insumoId: string;
  cantidadPlanificada: string;
  cantidadAplicada: string | null;
  unidad: string;
}

interface OrdenApi {
  id: string;
  loteId: string;
  tipoLabor: TipoLabor;
  asignadoA: string | null;
  estado: EstadoOrden;
  fechaInicio: string | null;
  fechaFin: string | null;
  dentroDeLoteInicio: boolean | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  insumos: OrdenInsumoApi[];
}

/**
 * El backend guarda el historial real en orden_estado_historial (lo llena
 * un trigger), pero no lo expone por REST — así que lo reconstruimos acá a
 * partir de fechaInicio/fechaFin/estado. "usuario" queda vacío: no hay
 * forma de resolver nombre desde un asignadoA (uuid) sin equipo real (§29).
 */
function historialDesdeApi(o: OrdenApi): HistorialEstado[] {
  const historial: HistorialEstado[] = [
    { estadoAnterior: null, estadoNuevo: "pendiente", fecha: o.createdAt, usuario: "" },
  ];
  if (o.fechaInicio) {
    historial.push({ estadoAnterior: "pendiente", estadoNuevo: "en_curso", fecha: o.fechaInicio, usuario: "" });
  }
  if (o.estado === "finalizada" && o.fechaFin) {
    historial.push({ estadoAnterior: "en_curso", estadoNuevo: "finalizada", fecha: o.fechaFin, usuario: "" });
  } else if (o.estado === "cancelada") {
    historial.push({
      estadoAnterior: o.fechaInicio ? "en_curso" : "pendiente",
      estadoNuevo: "cancelada",
      fecha: o.updatedAt,
      usuario: "",
    });
  } else if (o.estado === "requiere_revision") {
    historial.push({ estadoAnterior: "en_curso", estadoNuevo: "requiere_revision", fecha: o.updatedAt, usuario: "" });
  }
  return historial;
}

const ordenDesdeApi = (o: OrdenApi): OrdenTrabajo => {
  const insumos: OrdenInsumo[] = o.insumos.map((i) => ({
    insumoId: i.insumoId,
    planificada: Number(i.cantidadPlanificada),
    aplicada: i.cantidadAplicada !== null ? Number(i.cantidadAplicada) : null,
    unidad: i.unidad,
  }));
  return {
    id: o.id,
    loteId: o.loteId,
    tipoLabor: o.tipoLabor,
    asignadoA: o.asignadoA,
    estado: o.estado,
    fechaInicio: o.fechaInicio,
    fechaFin: o.fechaFin,
    dentroDeLoteInicio: o.dentroDeLoteInicio,
    insumos,
    historial: historialDesdeApi(o),
    sync: "sincronizado",
    version: o.version,
  };
};

function obtenerPosicion(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no soporta geolocalización"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("No se pudo obtener tu ubicación — activá el GPS y volvé a intentar")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

interface OrdenesContextValue {
  ordenes: OrdenTrabajo[];
  cargando: boolean;
  iniciar: (o: OrdenTrabajo) => Promise<{ dentro: boolean | null }>;
  cerrar: (id: string, aplicadas: Record<string, string>) => Promise<void>;
  cancelar: (o: OrdenTrabajo) => Promise<void>;
  crear: (orden: NuevaOrden) => Promise<string>;
}

const OrdenesContext = createContext<OrdenesContextValue | null>(null);

/**
 * Órdenes reales contra /ordenes-trabajo. El backend no tiene un listado
 * por establecimiento — GET exige loteId — así que se piden todas en
 * paralelo, una por lote, y se combinan acá.
 */
export function OrdenesProvider({ children }: { children: ReactNode }) {
  const { establecimiento } = useAuth();
  const { lotes, cargando: cargandoLotes } = useLotes();
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!establecimiento || cargandoLotes) return;
    if (lotes.length === 0) {
      setOrdenes([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    Promise.all(lotes.map((l) => api.get<OrdenApi[]>("/ordenes-trabajo", { loteId: l.id })))
      .then((porLote) => {
        if (cancelado) return;
        setOrdenes(porLote.flat().map(ordenDesdeApi));
      })
      .catch(() => {
        if (!cancelado) setOrdenes([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [establecimiento, lotes, cargandoLotes]);

  const iniciar: OrdenesContextValue["iniciar"] = async (o) => {
    const pos = await obtenerPosicion();
    const actualizada = await api.post<OrdenApi>(`/ordenes-trabajo/${o.id}/iniciar`, {
      ubicacionInicio: { type: "Point", coordinates: [pos.lng, pos.lat] },
      version: o.version,
    });
    const mapeada = ordenDesdeApi(actualizada);
    setOrdenes((prev) => prev.map((x) => (x.id === o.id ? mapeada : x)));
    return { dentro: mapeada.dentroDeLoteInicio };
  };

  const cerrar: OrdenesContextValue["cerrar"] = async (id, aplicadas) => {
    const orden = ordenes.find((o) => o.id === id);
    if (!orden) return;
    const pos = await obtenerPosicion();
    const insumosAplicados = orden.insumos.map((i) => ({
      insumoId: i.insumoId,
      cantidadAplicada: Number(aplicadas[i.insumoId] ?? i.planificada),
    }));
    const actualizada = await api.post<OrdenApi>(`/ordenes-trabajo/${id}/cerrar`, {
      ubicacionFin: { type: "Point", coordinates: [pos.lng, pos.lat] },
      insumosAplicados,
      version: orden.version,
    });
    const mapeada = ordenDesdeApi(actualizada);
    setOrdenes((prev) => prev.map((x) => (x.id === id ? mapeada : x)));
  };

  const cancelar: OrdenesContextValue["cancelar"] = async (o) => {
    const actualizada = await api.post<OrdenApi>(`/ordenes-trabajo/${o.id}/cancelar`, {
      version: o.version,
    });
    const mapeada = ordenDesdeApi(actualizada);
    setOrdenes((prev) => prev.map((x) => (x.id === o.id ? mapeada : x)));
  };

  const crear: OrdenesContextValue["crear"] = async (orden) => {
    const creada = await api.post<OrdenApi>("/ordenes-trabajo", {
      loteId: orden.loteId,
      tipoLabor: orden.tipoLabor,
      insumos: orden.insumos,
    });
    const mapeada = ordenDesdeApi(creada);
    setOrdenes((prev) => [mapeada, ...prev]);
    return mapeada.id;
  };

  return (
    <OrdenesContext.Provider value={{ ordenes, cargando, iniciar, cerrar, cancelar, crear }}>
      {children}
    </OrdenesContext.Provider>
  );
}

export function useOrdenes() {
  const ctx = useContext(OrdenesContext);
  if (!ctx) throw new Error("useOrdenes tiene que usarse dentro de <OrdenesProvider>");
  return ctx;
}
