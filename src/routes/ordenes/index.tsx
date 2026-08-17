import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Droplet,
  MapPin,
  Package,
  Play,
  Plus,
  Search,
  Sparkles,
  Sprout,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { Chip, EmptyHint, PageHeader, SectionLabel, Stat, SyncBadge } from "@/components/surco/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useOrdenes } from "@/lib/ordenes-store";
import { useCatalogos } from "@/lib/catalogos-store";
import { useLotes } from "@/lib/lotes-store";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  desvioPct,
  etiquetaEstado,
  etiquetaLabor,
  fechaHora,
  nf,
  nfInt,
  puedeGestionar,
  type EstadoOrden,
  type OrdenTrabajo,
  type TipoLabor,
} from "@/lib/surco-data";

export const Route = createFileRoute("/ordenes/")({
  head: () => ({
    meta: [
      { title: "Órdenes de trabajo — Surco" },
      {
        name: "description",
        content:
          "Alta, inicio y cierre de labores con historial de estados, validación geográfica y desvío de insumos planificado vs. aplicado.",
      },
      { property: "og:title", content: "Órdenes de trabajo — Surco" },
      { property: "og:description", content: "Historial de estados, inicio dentro del lote y desvío de insumos." },
    ],
  }),
  component: OrdenesPage,
});

const FILTROS: { valor: "todas" | EstadoOrden; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "pendiente", label: "Pendientes" },
  { valor: "en_curso", label: "En curso" },
  { valor: "finalizada", label: "Finalizadas" },
  { valor: "requiere_revision", label: "Revisión" },
];

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

export function OrdenesPage() {
  const isMobile = useIsMobile();
  const { establecimiento } = useAuth();
  const { ordenes, iniciar: iniciarCtx, cerrar: cerrarCtx, cancelar: cancelarCtx, crear } = useOrdenes();
  const { insumos } = useCatalogos();
  const { lotes } = useLotes();
  const nombreLote = (id: string) => lotes.find((l) => l.id === id)?.nombre ?? id;
  const [filtro, setFiltro] = useState<"todas" | EstadoOrden>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [nueva, setNueva] = useState(false);
  const [loteId, setLoteId] = useState("");
  const [labor, setLabor] = useState<TipoLabor>("pulverizacion");
  const [insumoId, setInsumoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [cerrando, setCerrando] = useState<OrdenTrabajo | null>(null);
  const [aplicadas, setAplicadas] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loteId && lotes.length) setLoteId(lotes[0]!.id);
  }, [lotes, loteId]);
  useEffect(() => {
    if (!insumoId && insumos.length) setInsumoId(insumos[0]!.id);
  }, [insumos, insumoId]);

  const visibles = useMemo(
    () => (filtro === "todas" ? ordenes : ordenes.filter((o) => o.estado === filtro)),
    [ordenes, filtro],
  );
  const visiblesMobile = useMemo(
    () =>
      visibles.filter((o) => {
        if (!busqueda.trim()) return true;
        const q = busqueda.toLowerCase();
        return (
          etiquetaLabor[o.tipoLabor].toLowerCase().includes(q) ||
          nombreLote(o.loteId).toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
        );
      }),
    [visibles, busqueda],
  );

  const iniciar = async (o: OrdenTrabajo) => {
    try {
      const { dentro } = await iniciarCtx(o);
      toast.success("Labor iniciada", {
        description:
          dentro === false
            ? "Atención: el inicio quedó fuera del polígono del lote."
            : "GPS dentro del polígono del lote.",
      });
    } catch (e) {
      toast.error("No se pudo iniciar la labor", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  const cancelar = async (o: OrdenTrabajo) => {
    try {
      await cancelarCtx(o);
      toast.info("Orden cancelada");
    } catch (e) {
      toast.error("No se pudo cancelar la orden", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  const cerrar = async () => {
    if (!cerrando) return;
    try {
      await cerrarCtx(cerrando.id, aplicadas);
      setCerrando(null);
      setAplicadas({});
      toast.success("Orden finalizada", { description: "Se calculó el desvío planificado vs. aplicado." });
    } catch (e) {
      toast.error("No se pudo finalizar la orden", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  if (isMobile) {
    return (
      <AppShell>
        <MobileOrdenesList
          ordenes={visiblesMobile}
          filtro={filtro}
          onFiltro={setFiltro}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          nombreLote={nombreLote}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Logística de campo · §09"
        title="Órdenes de trabajo"
        description="Ninguna transición se pisa: cada cambio de estado se agrega al historial con quién y cuándo."
        actions={
          puedeGestionar(establecimiento?.rol) ? (
          <Dialog open={nueva} onOpenChange={setNueva}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nueva orden
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva orden de trabajo</DialogTitle>
                <DialogDescription>La crea el agrónomo o el administrador con insumos planificados.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Lote</Label>
                    <Select value={loteId} onValueChange={setLoteId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {lotes.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Labor</Label>
                    <Select value={labor} onValueChange={(v) => setLabor(v as TipoLabor)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(etiquetaLabor) as TipoLabor[]).map((t) => (
                          <SelectItem key={t} value={t}>{etiquetaLabor[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Insumo planificado</Label>
                    <Select value={insumoId} onValueChange={setInsumoId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {insumos.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cant">
                    Cantidad planificada ({insumos.find((i) => i.id === insumoId)?.unidad})
                  </Label>
                  <Input id="cant" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="300" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!loteId}
                  onClick={async () => {
                    const unidad = insumos.find((i) => i.id === insumoId)?.unidad ?? "l";
                    try {
                      const id = await crear({
                        loteId,
                        tipoLabor: labor,
                        insumos: Number(cantidad) ? [{ insumoId, cantidad: Number(cantidad), unidad }] : [],
                      });
                      setNueva(false);
                      setCantidad("");
                      toast.success(`Orden ${id} creada`);
                    } catch (e) {
                      toast.error("No se pudo crear la orden", { description: mensajeError(e, "Intentá de nuevo.") });
                    }
                  }}
                >
                  Crear orden
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pendientes" value={String(ordenes.filter((o) => o.estado === "pendiente").length)} />
        <Stat label="En curso" value={String(ordenes.filter((o) => o.estado === "en_curso").length)} tone="ok" />
        <Stat
          label="Requieren revisión"
          value={String(ordenes.filter((o) => o.estado === "requiere_revision").length)}
          tone="warn"
          hint="sin actividad en 12 h"
        />
        <Stat
          label="Inicios fuera del lote"
          value={String(ordenes.filter((o) => o.dentroDeLoteInicio === false).length)}
          tone="danger"
          hint="ST_Contains = false"
        />
      </section>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as "todas" | EstadoOrden)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {FILTROS.map((f) => (
            <TabsTrigger key={f.valor} value={f.valor}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section className="space-y-3">
        <SectionLabel aside={`${visibles.length} órdenes`}>Listado</SectionLabel>
        {visibles.length === 0 ? (
          <EmptyHint>No hay órdenes con ese estado.</EmptyHint>
        ) : (
          <div className="space-y-3">
            {visibles.map((o) => (
              <article key={o.id} className="rounded-md border border-border bg-card">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg">{etiquetaLabor[o.tipoLabor]}</h2>
                      <Chip
                        tone={
                          o.estado === "requiere_revision"
                            ? "danger"
                            : o.estado === "en_curso"
                              ? "field"
                              : o.estado === "finalizada"
                                ? "ok"
                                : "neutral"
                        }
                      >
                        {etiquetaEstado[o.estado]}
                      </Chip>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {o.id} · {nombreLote(o.loteId)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {o.fechaInicio ? fechaHora(o.fechaInicio) : "sin iniciar"}
                        {o.fechaFin ? ` → ${fechaHora(o.fechaFin)}` : ""}
                      </span>
                      {o.dentroDeLoteInicio !== null ? (
                        <span
                          className={`flex items-center gap-1 ${o.dentroDeLoteInicio ? "text-ok" : "text-destructive"}`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {o.dentroDeLoteInicio ? "inicio dentro del lote" : "inicio fuera del lote"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <SyncBadge estado={o.sync} />
                </div>

                {o.insumos.length ? (
                  <div className="border-t border-border px-4 py-3">
                    <p className="label-field">Insumos</p>
                    <ul className="mt-2 space-y-2">
                      {o.insumos.map((i) => {
                        const pct = i.aplicada !== null ? desvioPct(i.aplicada, i.planificada) : null;
                        return (
                          <li
                            key={i.insumoId}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate">
                              {insumos.find((x) => x.id === i.insumoId)?.nombre}
                            </span>
                            <span className="num shrink-0 text-xs">
                              {nfInt(i.planificada)} {i.unidad} plan.
                              {i.aplicada !== null ? (
                                <>
                                  {" · "}
                                  {nfInt(i.aplicada)} {i.unidad} aplic.
                                  <span
                                    className={`ml-2 font-semibold ${Math.abs(pct!) >= 5 ? "text-warn" : "text-ok"}`}
                                  >
                                    {pct! > 0 ? "+" : ""}
                                    {nf(pct!)} %
                                  </span>
                                </>
                              ) : (
                                <span className="ml-2 text-muted-foreground">pendiente de cierre</span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <details className="border-t border-border px-4 py-3">
                  <summary className="label-field cursor-pointer select-none">
                    Historial de estados ({o.historial.length})
                  </summary>
                  <ol className="mt-3 space-y-2 border-l border-border pl-4">
                    {o.historial.map((h, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {h.estadoAnterior ? `${etiquetaEstado[h.estadoAnterior]} → ` : "creada · "}
                          {etiquetaEstado[h.estadoNuevo]}
                        </span>{" "}
                        · {fechaHora(h.fecha)}
                        {h.usuario ? ` · ${h.usuario}` : ""}
                      </li>
                    ))}
                  </ol>
                </details>

                <div className="flex flex-wrap gap-2 border-t border-border p-4">
                  {o.estado === "pendiente" ? (
                    <Button size="sm" onClick={() => iniciar(o)}>
                      <Play className="h-4 w-4" /> Iniciar labor
                    </Button>
                  ) : null}
                  {o.estado === "en_curso" || o.estado === "requiere_revision" ? (
                    <Button size="sm" onClick={() => setCerrando(o)}>
                      <CheckCircle2 className="h-4 w-4" /> Cerrar labor
                    </Button>
                  ) : null}
                  {(o.estado === "pendiente" || o.estado === "en_curso") && puedeGestionar(establecimiento?.rol) ? (
                    <Button size="sm" variant="outline" onClick={() => cancelar(o)}>
                      <XCircle className="h-4 w-4" /> Cancelar
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!cerrando} onOpenChange={(v) => !v && setCerrando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar {cerrando?.id}</DialogTitle>
            <DialogDescription>
              Se captura la ubicación de cierre y se compara lo aplicado contra lo planificado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {cerrando?.insumos.length ? (
              cerrando.insumos.map((i) => (
                <div key={i.insumoId} className="space-y-2">
                  <Label htmlFor={i.insumoId}>
                    {insumos.find((x) => x.id === i.insumoId)?.nombre} — aplicado ({i.unidad}) · plan.{" "}
                    {nfInt(i.planificada)}
                  </Label>
                  <Input
                    id={i.insumoId}
                    inputMode="decimal"
                    value={aplicadas[i.insumoId] ?? ""}
                    onChange={(e) => setAplicadas((p) => ({ ...p, [i.insumoId]: e.target.value }))}
                    placeholder={String(i.planificada)}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Esta orden no lleva insumos.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={cerrar}>Finalizar orden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export const ICONO_LABOR: Record<TipoLabor, typeof Droplet> = {
  pulverizacion: Droplet,
  fertilizacion: Sparkles,
  siembra: Sprout,
  cosecha: Package,
};

const TONO_ESTADO: Record<EstadoOrden, { chip: string; label: string }> = {
  pendiente: { chip: "bg-[#F7EDD9] text-[#A97A2E]", label: "Pendiente" },
  en_curso: { chip: "bg-[#E4EEEF] text-[#4E7C8B]", label: "En curso" },
  finalizada: { chip: "bg-[#E6F1E8] text-[#4C8F5B]", label: "Finalizada" },
  cancelada: { chip: "bg-foreground/10 text-muted-foreground", label: "Cancelada" },
  requiere_revision: { chip: "bg-[#F5E4DE] text-[#B15A42]", label: "Requiere revisión" },
};

const ICONO_TONO: Record<TipoLabor, string> = {
  pulverizacion: "bg-[#E4EEEF] text-[#4E7C8B]",
  fertilizacion: "bg-[#F7EDD9] text-[#A97A2E]",
  siembra: "bg-[#E6F1E8] text-[#4C8F5B]",
  cosecha: "bg-[#F5E4DE] text-[#B15A42]",
};

/**
 * Lista móvil — replica surco_mobile_flujos_2.html screen 4: buscador,
 * chips de estado con scroll horizontal, tarjetas compactas por orden
 * que navegan al detalle (/ordenes/$id) en vez de tener acciones inline
 * como la vista de escritorio.
 */
function MobileOrdenesList({
  ordenes,
  filtro,
  onFiltro,
  busqueda,
  onBusqueda,
  nombreLote,
}: {
  ordenes: OrdenTrabajo[];
  filtro: "todas" | EstadoOrden;
  onFiltro: (v: "todas" | EstadoOrden) => void;
  busqueda: string;
  onBusqueda: (v: string) => void;
  nombreLote: (id: string) => string;
}) {
  return (
    <div className="-mx-4 -mt-5 sm:-mx-6">
      <div className="px-5 pt-5">
        <h1 className="font-display text-xl font-semibold tracking-tight">Órdenes de trabajo</h1>

        <div className="mt-4 flex items-center gap-2 rounded-xl border-[1.4px] border-border bg-card px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Buscar orden..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => onFiltro(f.valor)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border-[1.4px] px-3.5 py-1.5 text-[11.5px] font-semibold",
                filtro === f.valor
                  ? "border-surface-ink bg-surface-ink text-surface-ink-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-5 pt-4">
        {ordenes.length === 0 ? (
          <EmptyHint>No hay órdenes que coincidan.</EmptyHint>
        ) : (
          ordenes.map((o) => {
            const Icono = ICONO_LABOR[o.tipoLabor];
            const tono = TONO_ESTADO[o.estado];
            return (
              <Link
                key={o.id}
                to="/ordenes/$id"
                params={{ id: o.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3.5 transition-colors active:border-foreground/20"
              >
                <div className={cn("grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px]", ICONO_TONO[o.tipoLabor])}>
                  <Icono className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold text-foreground">
                    {etiquetaLabor[o.tipoLabor]}
                  </strong>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                    {nombreLote(o.loteId)} · {o.id}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold", tono.chip)}>{tono.label}</span>
                  <span className="num text-[10.5px] text-muted-foreground">
                    {o.fechaInicio ? fechaHora(o.fechaInicio) : "Sin iniciar"}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
