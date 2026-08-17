import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useCatalogos } from "@/lib/catalogos-store";
import type { Calibracion } from "@/lib/surco-data";

export type NuevaCalibracion = Omit<Calibracion, "id" | "fecha">;

interface CalibracionApi {
  id: string;
  maquinaId: string;
  tipoCalculo: Calibracion["tipoCalculo"];
  resumen: string;
  resultado: string;
  desvioPct: string | null;
  alerta: boolean;
  fecha: string;
}

const calibracionDesdeApi = (c: CalibracionApi): Calibracion => ({
  id: c.id,
  maquinaId: c.maquinaId,
  tipoCalculo: c.tipoCalculo,
  resumen: c.resumen,
  resultado: c.resultado,
  desvioPct: c.desvioPct !== null ? Number(c.desvioPct) : null,
  alerta: c.alerta,
  fecha: c.fecha,
});

interface CalibracionesContextValue {
  calibraciones: Calibracion[];
  cargando: boolean;
  guardar: (c: NuevaCalibracion) => Promise<void>;
}

const CalibracionesContext = createContext<CalibracionesContextValue | null>(null);

/**
 * Calibraciones reales — el cálculo (caudal por boquilla / distancia
 * entre semillas) corre en el dispositivo, acá solo se persiste el
 * resultado. Sin POST dedicado, igual que scouting: el alta va por
 * /sync/push y después se refetchea, porque el push no devuelve la
 * entidad creada. El backend exige maquinaId para listar, así que se
 * piden todas en paralelo, una por máquina del catálogo.
 */
export function CalibracionesProvider({ children }: { children: ReactNode }) {
  const { establecimiento } = useAuth();
  const { maquinas, cargando: cargandoMaquinas } = useCatalogos();
  const [calibraciones, setCalibraciones] = useState<Calibracion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!establecimiento || cargandoMaquinas) return;
    if (maquinas.length === 0) {
      setCalibraciones([]);
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    Promise.all(maquinas.map((m) => api.get<CalibracionApi[]>("/calibraciones", { maquinaId: m.id })))
      .then((porMaquina) => {
        if (cancelado) return;
        setCalibraciones(porMaquina.flat().map(calibracionDesdeApi));
      })
      .catch(() => {
        if (!cancelado) setCalibraciones([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [establecimiento, maquinas, cargandoMaquinas]);

  const guardar: CalibracionesContextValue["guardar"] = async (c) => {
    await api.post("/sync/push", {
      changes: [
        {
          id: crypto.randomUUID(),
          tabla: "calibraciones",
          operacion: "create",
          version: 1,
          payload: {
            establecimientoId: establecimiento!.id,
            maquinaId: c.maquinaId,
            fecha: new Date().toISOString(),
            tipoCalculo: c.tipoCalculo,
            resumen: c.resumen,
            resultado: c.resultado,
            desvioPct: c.desvioPct,
            alerta: c.alerta,
          },
        },
      ],
    });
    const lista = await api.get<CalibracionApi[]>("/calibraciones", { maquinaId: c.maquinaId });
    setCalibraciones((prev) => [
      ...lista.map(calibracionDesdeApi),
      ...prev.filter((x) => x.maquinaId !== c.maquinaId),
    ]);
  };

  return (
    <CalibracionesContext.Provider value={{ calibraciones, cargando, guardar }}>
      {children}
    </CalibracionesContext.Provider>
  );
}

export function useCalibraciones() {
  const ctx = useContext(CalibracionesContext);
  if (!ctx) throw new Error("useCalibraciones tiene que usarse dentro de <CalibracionesProvider>");
  return ctx;
}
