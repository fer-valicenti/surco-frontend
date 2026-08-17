import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { aGeoJson, desdeGeoJson, type GeoJsonPolygon } from "@/lib/geo";
import type { Lote, Poligono } from "@/lib/surco-data";

export type NuevoLote = {
  nombre: string;
  poligono: Poligono;
  cultivoActual: string;
  campania: string;
};

interface LoteApi {
  id: string;
  nombre: string;
  poligono: GeoJsonPolygon;
  superficieHa: string | null;
  cultivoActual: string | null;
  campania: string | null;
}

const loteDesdeApi = (l: LoteApi): Lote => ({
  id: l.id,
  nombre: l.nombre,
  superficieHa: l.superficieHa !== null ? Number(l.superficieHa) : 0,
  poligono: desdeGeoJson(l.poligono),
  cultivoActual: l.cultivoActual ?? "Sin definir",
  campania: l.campania ?? "",
  sync: "sincronizado",
});

interface LotesContextValue {
  lotes: Lote[];
  cargando: boolean;
  crear: (l: NuevoLote) => Promise<Lote>;
}

const LotesContext = createContext<LotesContextValue | null>(null);

/** Lotes reales — mismo patrón que catalogos-store: se cargan al montar y las altas pegan directo contra /lotes. */
export function LotesProvider({ children }: { children: ReactNode }) {
  const { establecimiento, autenticado } = useAuth();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!autenticado || !establecimiento) {
      setCargando(false);
      return;
    }
    setCargando(true);
    api
      .get<LoteApi[]>("/lotes", { establecimientoId: establecimiento.id })
      .then((r) => setLotes(r.map(loteDesdeApi)))
      .finally(() => setCargando(false));
  }, [autenticado, establecimiento]);

  const crear: LotesContextValue["crear"] = async (l) => {
    const creado = await api.post<LoteApi>("/lotes", {
      establecimientoId: establecimiento!.id,
      nombre: l.nombre,
      poligono: aGeoJson(l.poligono),
      cultivoActual: l.cultivoActual || undefined,
      campania: l.campania || undefined,
    });
    const mapeado = loteDesdeApi(creado);
    setLotes((prev) => [mapeado, ...prev]);
    return mapeado;
  };

  return <LotesContext.Provider value={{ lotes, cargando, crear }}>{children}</LotesContext.Provider>;
}

export function useLotes() {
  const ctx = useContext(LotesContext);
  if (!ctx) throw new Error("useLotes tiene que usarse dentro de <LotesProvider>");
  return ctx;
}
