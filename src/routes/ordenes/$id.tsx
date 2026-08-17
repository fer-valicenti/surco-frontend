import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, MapPin, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { useOrdenes } from "@/lib/ordenes-store";
import { useCatalogos } from "@/lib/catalogos-store";
import { useLotes } from "@/lib/lotes-store";
import { MapaMiniPoligono } from "@/components/surco/mapa-mini";
import { cn } from "@/lib/utils";
import { desvioPct, etiquetaLabor, fechaHora, nf, nfInt, type Poligono } from "@/lib/surco-data";
import { ICONO_LABOR } from "./index";

export const Route = createFileRoute("/ordenes/$id")({
  component: OrdenDetalle,
});

const TONO_ESTADO: Record<string, { chip: string; label: string }> = {
  pendiente: { chip: "bg-[#F7EDD9] text-[#A97A2E]", label: "Pendiente" },
  en_curso: { chip: "bg-[#E4EEEF] text-[#4E7C8B]", label: "En curso" },
  finalizada: { chip: "bg-[#E6F1E8] text-[#4C8F5B]", label: "Finalizada" },
  cancelada: { chip: "bg-foreground/10 text-muted-foreground", label: "Cancelada" },
  requiere_revision: { chip: "bg-[#F5E4DE] text-[#B15A42]", label: "Requiere revisión" },
};

function MiniMapa({ puntos, dentro }: { puntos: Poligono; dentro: boolean | null }) {
  return (
    <div>
      <MapaMiniPoligono puntos={puntos} color={dentro === false ? "#B15A42" : "#4C8F5B"} />
      {dentro !== null ? (
        <span
          className={cn(
            "mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold",
            dentro ? "bg-[#E6F1E8] text-[#4C8F5B]" : "bg-[#F5E4DE] text-[#B15A42]",
          )}
        >
          <MapPin className="h-3 w-3" />
          {dentro ? "Estás dentro del lote" : "Fuera del polígono del lote"}
        </span>
      ) : null}
    </div>
  );
}

function OrdenDetalle() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { ordenes, iniciar, cerrar } = useOrdenes();
  const { insumos } = useCatalogos();
  const { lotes } = useLotes();
  const nombreLote = (loteId: string) => lotes.find((l) => l.id === loteId)?.nombre ?? loteId;
  const [aplicadas, setAplicadas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  const orden = ordenes.find((o) => o.id === id);
  if (!orden) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Esta orden ya no existe.</p>
        <Button asChild variant="outline">
          <Link to="/ordenes">Volver a órdenes</Link>
        </Button>
      </div>
    );
  }

  const Icono = ICONO_LABOR[orden.tipoLabor];
  const tono = TONO_ESTADO[orden.estado];
  const lote = lotes.find((l) => l.id === orden.loteId);

  const handleIniciar = async () => {
    setEnviando(true);
    try {
      await iniciar(orden);
      toast.success("Labor iniciada", { description: "Se registró tu ubicación y hora de inicio." });
    } catch (e) {
      toast.error("No se pudo iniciar la labor", {
        description: e instanceof ApiError || e instanceof Error ? e.message : "Intentá de nuevo.",
      });
    } finally {
      setEnviando(false);
    }
  };

  const handleFinalizar = async () => {
    setEnviando(true);
    try {
      await cerrar(orden.id, aplicadas);
      toast.success("Orden finalizada", { description: "Se calculó el desvío planificado vs. aplicado." });
      navigate({ to: "/ordenes" });
    } catch (e) {
      toast.error("No se pudo finalizar la orden", {
        description: e instanceof ApiError || e instanceof Error ? e.message : "Intentá de nuevo.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <button
          onClick={() => navigate({ to: "/ordenes" })}
          aria-label="Volver"
          className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-card text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <strong className="font-display text-sm text-foreground">
          {orden.estado === "pendiente" ? "Orden de trabajo" : "Finalizar labor"}
        </strong>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold", tono.chip)}>
          {tono.label}
        </span>
      </div>

      <div className="px-5">
        <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-xl", "bg-[#E4EEEF] text-[#4E7C8B]")}>
          <Icono className="h-5 w-5" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {etiquetaLabor[orden.tipoLabor]}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {nombreLote(orden.loteId)} · <span className="num">{lote ? nf(lote.superficieHa) : "—"} ha</span>
          {orden.fechaInicio ? ` · ${fechaHora(orden.fechaInicio)}` : ""}
        </p>

        {orden.estado === "en_curso" || orden.estado === "requiere_revision" ? (
          <span className="mt-3 inline-block rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
            Iniciada {orden.fechaInicio ? fechaHora(orden.fechaInicio) : ""}
          </span>
        ) : null}

        <div className="mt-5 rounded-2xl border border-border bg-card p-3.5">
          <p className="label-field mb-2.5">Ubicación</p>
          {lote ? <MiniMapa puntos={lote.poligono} dentro={orden.dentroDeLoteInicio} /> : null}
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-card p-3.5">
          <p className="label-field mb-2.5">
            {orden.estado === "pendiente" ? "Insumos planificados" : "Insumos aplicados"}
          </p>
          {orden.insumos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esta orden no lleva insumos.</p>
          ) : (
            <ul className="space-y-3">
              {orden.insumos.map((i) => {
                const nombreInsumo = insumos.find((x) => x.id === i.insumoId)?.nombre ?? i.insumoId;
                const puedeEditar = orden.estado === "en_curso" || orden.estado === "requiere_revision";
                const valorActual = aplicadas[i.insumoId] ?? String(i.aplicada ?? "");
                const pct = valorActual && Number(valorActual) ? desvioPct(Number(valorActual), i.planificada) : null;

                if (!puedeEditar) {
                  return (
                    <li key={i.insumoId} className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">{nombreInsumo}</span>
                      <span className="num text-muted-foreground">
                        {nfInt(i.planificada)} {i.unidad}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={i.insumoId}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-foreground">{nombreInsumo}</span>
                      <span className="num text-[11px] text-muted-foreground">
                        plan. {nfInt(i.planificada)} {i.unidad}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                        <input
                          inputMode="decimal"
                          value={valorActual}
                          onChange={(e) => setAplicadas((p) => ({ ...p, [i.insumoId]: e.target.value }))}
                          placeholder={String(i.planificada)}
                          className="num w-full bg-transparent text-sm text-foreground outline-none"
                        />
                        <span className="text-xs text-muted-foreground">{i.unidad}</span>
                      </div>
                      {pct !== null ? (
                        <span
                          className={cn(
                            "num shrink-0 rounded-md px-2 py-1 text-[11px] font-bold",
                            Math.abs(pct) < 1
                              ? "bg-[#E6F1E8] text-[#4C8F5B]"
                              : "bg-[#F7EDD9] text-[#A97A2E]",
                          )}
                        >
                          {pct > 0 ? "+" : ""}
                          {nf(pct)}%
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6">
          {orden.estado === "pendiente" ? (
            <>
              <Button
                onClick={handleIniciar}
                disabled={enviando}
                className="h-12 w-full gap-2 rounded-xl text-[14px] font-bold"
              >
                <Play className="h-4 w-4" /> Iniciar labor
              </Button>
              <p className="mt-2.5 text-center text-[11.5px] text-muted-foreground">
                Se registra tu ubicación y hora de inicio
              </p>
            </>
          ) : null}
          {orden.estado === "en_curso" || orden.estado === "requiere_revision" ? (
            <>
              <Button
                onClick={handleFinalizar}
                disabled={enviando}
                className="h-12 w-full gap-2 rounded-xl bg-ok text-[14px] font-bold text-ok-foreground hover:bg-ok/90"
              >
                <Check className="h-4 w-4" /> Finalizar labor
              </Button>
              <p className="mt-2.5 text-center text-[11.5px] text-muted-foreground">
                Se registra tu ubicación y hora de cierre
              </p>
            </>
          ) : null}
          {orden.estado === "finalizada" ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-[#E6F1E8] py-3 text-sm font-semibold text-[#4C8F5B]">
              <Check className="h-4 w-4" /> Labor finalizada
              {orden.fechaFin ? ` · ${fechaHora(orden.fechaFin)}` : ""}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
