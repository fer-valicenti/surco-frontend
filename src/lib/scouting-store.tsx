import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useLotes } from "@/lib/lotes-store";
import { centroide } from "@/lib/geo";
import type { MetodoCuantificacion, RegistroScouting } from "@/lib/surco-data";

export type NuevoHallazgo = {
  loteId: string;
  especieId: string | null;
  descripcionLibre: string | null;
  valorMedido: number;
  metodoCuantificacion: MetodoCuantificacion;
  sospechaResistencia: boolean;
};

interface FotoApi {
  id: string;
  estado: "pendiente" | "subiendo" | "subida" | "error";
}

interface RegistroApi {
  id: string;
  loteId: string;
  especieId: string | null;
  fecha: string;
  ubicacion: { type: "Point"; coordinates: [number, number] };
  valorMedido: string;
  superaUmbral: boolean | null;
  sospechaResistencia: boolean;
  descripcionNoCatalogada: string | null;
  pendienteRevision: boolean;
  fotos: FotoApi[];
}

const registroDesdeApi = (r: RegistroApi): RegistroScouting => ({
  id: r.id,
  loteId: r.loteId,
  especieId: r.especieId,
  descripcionLibre: r.descripcionNoCatalogada,
  pendienteRevision: r.pendienteRevision,
  fecha: r.fecha,
  valorMedido: Number(r.valorMedido),
  superaUmbral: r.superaUmbral ?? false,
  sospechaResistencia: r.sospechaResistencia,
  fotos: r.fotos.length,
  fotosPendientes: r.fotos.filter((f) => f.estado !== "subida").length,
  lat: r.ubicacion.coordinates[1],
  lng: r.ubicacion.coordinates[0],
  sync: "sincronizado",
});

/** Best-effort: si no hay GPS (denegado, no disponible) cae al centroide del lote — a diferencia de órdenes, acá la ubicación no se valida contra ningún polígono en el servidor. */
function obtenerPosicion(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

interface ScoutingContextValue {
  registros: RegistroScouting[];
  cargando: boolean;
  guardar: (h: NuevoHallazgo) => Promise<void>;
  resolver: (id: string, especieId: string) => Promise<void>;
}

const ScoutingContext = createContext<ScoutingContextValue | null>(null);

/**
 * Hallazgos reales. El backend no tiene listado por establecimiento — GET
 * exige loteId, igual que /ordenes-trabajo — así que se piden todos en
 * paralelo, una por lote. El alta no tiene POST dedicado (ver
 * entity-registry.ts): va por /sync/push, que no devuelve la entidad
 * creada, así que después de empujar el cambio se vuelve a pedir todo.
 */
export function ScoutingProvider({ children }: { children: ReactNode }) {
  const { establecimiento } = useAuth();
  const { lotes, cargando: cargandoLotes } = useLotes();
  const [registros, setRegistros] = useState<RegistroScouting[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!establecimiento || cargandoLotes) return;
    if (lotes.length === 0) {
      setRegistros([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    Promise.all(lotes.map((l) => api.get<RegistroApi[]>("/scouting", { loteId: l.id })))
      .then((porLote) => {
        if (cancelado) return;
        setRegistros(porLote.flat().map(registroDesdeApi));
      })
      .catch(() => {
        if (!cancelado) setRegistros([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [establecimiento, lotes, cargandoLotes]);

  const guardar: ScoutingContextValue["guardar"] = async (h) => {
    const lote = lotes.find((l) => l.id === h.loteId);
    const gps = await obtenerPosicion();
    const posicion = gps ?? (lote ? { lat: centroide(lote.poligono)[0], lng: centroide(lote.poligono)[1] } : null);
    if (!posicion) throw new Error("No se pudo determinar una ubicación para el hallazgo");

    await api.post("/sync/push", {
      changes: [
        {
          id: crypto.randomUUID(),
          tabla: "registros_scouting",
          operacion: "create",
          version: 1,
          payload: {
            establecimientoId: establecimiento!.id,
            loteId: h.loteId,
            especieId: h.especieId,
            fecha: new Date().toISOString(),
            ubicacion: { type: "Point", coordinates: [posicion.lng, posicion.lat] },
            metodoCuantificacion: h.metodoCuantificacion,
            valorMedido: h.valorMedido,
            sospechaResistencia: h.sospechaResistencia,
            descripcionNoCatalogada: h.descripcionLibre,
            pendienteRevision: !h.especieId,
          },
        },
      ],
    });

    const porLote = await Promise.all(lotes.map((l) => api.get<RegistroApi[]>("/scouting", { loteId: l.id })));
    setRegistros(porLote.flat().map(registroDesdeApi));
  };

  const resolver: ScoutingContextValue["resolver"] = async (id, especieId) => {
    const actualizado = await api.post<RegistroApi>(`/scouting/${id}/resolver`, { especieId });
    const mapeado = registroDesdeApi(actualizado);
    setRegistros((prev) => prev.map((r) => (r.id === id ? mapeado : r)));
  };

  return (
    <ScoutingContext.Provider value={{ registros, cargando, guardar, resolver }}>
      {children}
    </ScoutingContext.Provider>
  );
}

export function useScouting() {
  const ctx = useContext(ScoutingContext);
  if (!ctx) throw new Error("useScouting tiene que usarse dentro de <ScoutingProvider>");
  return ctx;
}
