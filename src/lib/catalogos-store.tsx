import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { aGeoJson, desdeGeoJson, type GeoJsonPolygon } from "@/lib/geo";
import type {
  Especie,
  CategoriaGanado,
  Maquina,
  Insumo,
  Potrero,
  TipoHallazgo,
  MetodoCuantificacion,
  EstadoPotrero,
  TipoMaquina,
  TipoInsumo,
  Poligono,
} from "@/lib/surco-data";

export type NuevaEspecie = {
  tipo: TipoHallazgo;
  nombreComun: string;
  nombreCientifico: string;
  metodo: MetodoCuantificacion;
  umbralAccion: number | null;
  unidadMedida: string;
};
export type NuevaCategoriaGanado = { nombre: string; ev: number };
export type NuevaMaquina = {
  nombre: string;
  tipo: TipoMaquina;
  marca?: string;
  modelo?: string;
  espaciamientoM: number | null;
};
export type NuevoInsumo = { nombre: string; tipo: TipoInsumo; unidad: string };
export type NuevoPotrero = {
  nombre: string;
  superficieHa: number;
  poligono: Poligono;
  estado: EstadoPotrero;
  cargaRecomendadaEvHa: number;
};

interface CatalogosContextValue {
  especies: Especie[];
  categoriasGanado: CategoriaGanado[];
  maquinas: Maquina[];
  insumos: Insumo[];
  potreros: Potrero[];
  cargando: boolean;
  agregarEspecie: (e: NuevaEspecie) => Promise<Especie>;
  agregarCategoriaGanado: (c: NuevaCategoriaGanado) => Promise<CategoriaGanado>;
  agregarMaquina: (m: NuevaMaquina) => Promise<Maquina>;
  agregarInsumo: (i: NuevoInsumo) => Promise<Insumo>;
  agregarPotrero: (p: NuevoPotrero) => Promise<Potrero>;
}

const CatalogosContext = createContext<CatalogosContextValue | null>(null);

/* ------------------------------- API <-> UI -------------------------------- */

interface EspecieApi {
  id: string;
  tipo: TipoHallazgo;
  nombreComun: string;
  nombreCientifico: string | null;
  metodoCuantificacion: MetodoCuantificacion;
  umbralAccion: string | null;
  unidadUmbral: string | null;
}
const especieDesdeApi = (e: EspecieApi): Especie => ({
  id: e.id,
  tipo: e.tipo,
  nombreComun: e.nombreComun,
  nombreCientifico: e.nombreCientifico ?? "",
  metodo: e.metodoCuantificacion,
  umbralAccion: e.umbralAccion !== null ? Number(e.umbralAccion) : null,
  unidadMedida: e.unidadUmbral ?? "",
});

interface CategoriaApi {
  id: string;
  nombre: string;
  equivalenciaEv: string;
}
const categoriaDesdeApi = (c: CategoriaApi): CategoriaGanado => ({ id: c.id, nombre: c.nombre, ev: Number(c.equivalenciaEv) });

interface MaquinaApi {
  id: string;
  nombre: string;
  tipo: TipoMaquina;
  marca: string | null;
  modelo: string | null;
  anchoLaborM: string | null;
}
const maquinaDesdeApi = (m: MaquinaApi): Maquina => ({
  id: m.id,
  nombre: m.nombre,
  tipo: m.tipo,
  marca: m.marca,
  modelo: m.modelo,
  espaciamientoM: m.anchoLaborM !== null ? Number(m.anchoLaborM) : null,
});

interface InsumoApi {
  id: string;
  nombre: string;
  tipo: TipoInsumo;
  unidadDefault: string;
}
const insumoDesdeApi = (i: InsumoApi): Insumo => ({ id: i.id, nombre: i.nombre, tipo: i.tipo, unidad: i.unidadDefault });

interface PotreroApi {
  id: string;
  nombre: string;
  poligono: GeoJsonPolygon;
  superficieHa: string | null;
  cargaRecomendadaEvHa: string | null;
  estado: EstadoPotrero;
}
const potreroDesdeApi = (p: PotreroApi): Potrero => ({
  id: p.id,
  nombre: p.nombre,
  superficieHa: p.superficieHa !== null ? Number(p.superficieHa) : 0,
  poligono: desdeGeoJson(p.poligono),
  estado: p.estado,
  cargaRecomendadaEvHa: p.cargaRecomendadaEvHa !== null ? Number(p.cargaRecomendadaEvHa) : 0,
});

/**
 * Catálogos compartidos — conectado al backend real. Cada dominio se
 * carga al montar (una vez que hay establecimiento activo) y las altas
 * pegan directo contra la API; el resto de la app (scouting, calibración,
 * ganadería, órdenes) sigue leyendo de acá sin cambios.
 */
export function CatalogosProvider({ children }: { children: ReactNode }) {
  const { establecimiento, autenticado } = useAuth();
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [categoriasGanado, setCategoriasGanado] = useState<CategoriaGanado[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [potreros, setPotreros] = useState<Potrero[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!autenticado || !establecimiento) {
      setCargando(false);
      return;
    }
    const establecimientoId = establecimiento.id;
    setCargando(true);
    Promise.all([
      api.get<EspecieApi[]>("/especies", { establecimientoId }).then((r) => setEspecies(r.map(especieDesdeApi))),
      api.get<CategoriaApi[]>("/categorias-ganado", { establecimientoId }).then((r) => setCategoriasGanado(r.map(categoriaDesdeApi))),
      api.get<MaquinaApi[]>("/maquinas", { establecimientoId }).then((r) => setMaquinas(r.map(maquinaDesdeApi))),
      api.get<InsumoApi[]>("/insumos", { establecimientoId }).then((r) => setInsumos(r.map(insumoDesdeApi))),
      api.get<PotreroApi[]>("/potreros", { establecimientoId }).then((r) => setPotreros(r.map(potreroDesdeApi))),
    ]).finally(() => setCargando(false));
  }, [autenticado, establecimiento]);

  const agregarEspecie: CatalogosContextValue["agregarEspecie"] = async (e) => {
    const creada = await api.post<EspecieApi>("/especies", {
      tipo: e.tipo,
      nombreComun: e.nombreComun,
      nombreCientifico: e.nombreCientifico || undefined,
      metodoCuantificacion: e.metodo,
      umbralAccion: e.umbralAccion ?? undefined,
      unidadUmbral: e.unidadMedida || undefined,
    });
    const mapeada = especieDesdeApi(creada);
    setEspecies((prev) => [...prev, mapeada]);
    return mapeada;
  };

  const agregarCategoriaGanado: CatalogosContextValue["agregarCategoriaGanado"] = async (c) => {
    const creada = await api.post<CategoriaApi>("/categorias-ganado", {
      establecimientoId: establecimiento!.id,
      nombre: c.nombre,
      equivalenciaEv: c.ev,
    });
    const mapeada = categoriaDesdeApi(creada);
    setCategoriasGanado((prev) => [...prev, mapeada]);
    return mapeada;
  };

  const agregarMaquina: CatalogosContextValue["agregarMaquina"] = async (m) => {
    const creada = await api.post<MaquinaApi>("/maquinas", {
      establecimientoId: establecimiento!.id,
      nombre: m.nombre,
      tipo: m.tipo,
      marca: m.marca || undefined,
      modelo: m.modelo || undefined,
      anchoLaborM: m.espaciamientoM ?? undefined,
    });
    const mapeada = maquinaDesdeApi(creada);
    setMaquinas((prev) => [...prev, mapeada]);
    return mapeada;
  };

  const agregarInsumo: CatalogosContextValue["agregarInsumo"] = async (i) => {
    const creado = await api.post<InsumoApi>("/insumos", {
      establecimientoId: establecimiento!.id,
      nombre: i.nombre,
      tipo: i.tipo,
      unidadDefault: i.unidad,
    });
    const mapeado = insumoDesdeApi(creado);
    setInsumos((prev) => [...prev, mapeado]);
    return mapeado;
  };

  const agregarPotrero: CatalogosContextValue["agregarPotrero"] = async (p) => {
    const creado = await api.post<PotreroApi>("/potreros", {
      establecimientoId: establecimiento!.id,
      nombre: p.nombre,
      poligono: aGeoJson(p.poligono),
      cargaRecomendadaEvHa: p.cargaRecomendadaEvHa,
    });
    const mapeado = potreroDesdeApi(creado);
    setPotreros((prev) => [...prev, mapeado]);
    return mapeado;
  };

  return (
    <CatalogosContext.Provider
      value={{
        especies,
        categoriasGanado,
        maquinas,
        insumos,
        potreros,
        cargando,
        agregarEspecie,
        agregarCategoriaGanado,
        agregarMaquina,
        agregarInsumo,
        agregarPotrero,
      }}
    >
      {children}
    </CatalogosContext.Provider>
  );
}

export function useCatalogos() {
  const ctx = useContext(CatalogosContext);
  if (!ctx) throw new Error("useCatalogos tiene que usarse dentro de <CatalogosProvider>");
  return ctx;
}
