import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Camera, Crosshair, Plus, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { Chip, EmptyHint, PageHeader, SectionLabel, Stat, SyncBadge } from "@/components/surco/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useScouting } from "@/lib/scouting-store";
import { useCatalogos } from "@/lib/catalogos-store";
import { useLotes } from "@/lib/lotes-store";
import { cn } from "@/lib/utils";
import { FotoAutenticada } from "@/components/surco/foto-autenticada";
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
  etiquetaMetodo,
  fechaHora,
  nf,
  puedeGestionar,
  type RegistroScouting,
  type TipoHallazgo,
} from "@/lib/surco-data";

export const Route = createFileRoute("/scouting/")({
  head: () => ({
    meta: [
      { title: "Scouting agronómico — Surco" },
      {
        name: "description",
        content:
          "Cuaderno de campo digital: hallazgos georreferenciados de plagas, malezas y enfermedades con umbral de acción y cola de fotos.",
      },
      { property: "og:title", content: "Scouting agronómico — Surco" },
      { property: "og:description", content: "Hallazgos con especie de catálogo, umbral de acción y fotos georreferenciadas." },
    ],
  }),
  component: ScoutingPage,
});

const TIPOS: { valor: "todos" | TipoHallazgo; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "plaga", label: "Plagas" },
  { valor: "maleza", label: "Malezas" },
  { valor: "enfermedad", label: "Enfermedades" },
];

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

/** Se usa desde el desktop y el mobile — cada uno con su propio estado de "cuál está abierta". */
function DialogoFotos({
  registroId,
  open,
  onOpenChange,
}: {
  registroId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [fotos, setFotos] = useState<{ id: string }[] | null>(null);

  useEffect(() => {
    if (!open) {
      setFotos(null);
      return;
    }
    api
      .get<{ id: string }[]>(`/scouting/${registroId}/fotos`)
      .then(setFotos)
      .catch(() => setFotos([]));
  }, [open, registroId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fotos del hallazgo</DialogTitle>
        </DialogHeader>
        {fotos === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : fotos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin fotos.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f) => (
              <FotoAutenticada key={f.id} fotoId={f.id} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScoutingPage() {
  const isMobile = useIsMobile();
  const { establecimiento } = useAuth();
  const { registros, guardar: guardarCtx, resolver: resolverCtx } = useScouting();
  const { especies } = useCatalogos();
  const { lotes } = useLotes();
  const nombreLote = (id: string) => lotes.find((l) => l.id === id)?.nombre ?? id;
  const [tipo, setTipo] = useState<"todos" | TipoHallazgo>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [loteId, setLoteId] = useState("");
  const [especieId, setEspecieId] = useState("");
  const [valor, setValor] = useState("");
  const [resistencia, setResistencia] = useState(false);
  const [resolviendo, setResolviendo] = useState<RegistroScouting | null>(null);
  const [especieResolver, setEspecieResolver] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [galeriaAbiertaPara, setGaleriaAbiertaPara] = useState<string | null>(null);

  useEffect(() => {
    if (!loteId && lotes.length) setLoteId(lotes[0]!.id);
  }, [lotes, loteId]);
  useEffect(() => {
    if (!especieId && especies.length) setEspecieId(especies[0]!.id);
  }, [especies, especieId]);

  const especie = especies.find((e) => e.id === especieId) ?? null;
  const visibles =
    tipo === "todos"
      ? registros
      : registros.filter((r) => especies.find((e) => e.id === r.especieId)?.tipo === tipo);
  const visiblesMobile = visibles.filter((r) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    const esp = r.especieId ? especies.find((e) => e.id === r.especieId) : null;
    return (esp?.nombreComun.toLowerCase().includes(q) ?? false) || nombreLote(r.loteId).toLowerCase().includes(q);
  });

  const pendientesFoto = registros.reduce((a, r) => a + r.fotosPendientes, 0);

  const guardar = async () => {
    if (!especie) {
      toast.error("Elegí una especie del catálogo");
      return;
    }
    if (!Number(valor)) {
      toast.error("Falta el valor medido");
      return;
    }
    setEnviando(true);
    try {
      // Sin captura de fotos acá a propósito — es el alta rápida de
      // escritorio; el flujo completo con fotos vive en /scouting/nuevo.
      await guardarCtx(
        {
          loteId,
          especieId,
          descripcionLibre: null,
          valorMedido: Number(valor),
          metodoCuantificacion: especie.metodo,
          sospechaResistencia: resistencia,
        },
        [],
      );
      setAbierto(false);
      setValor("");
      setResistencia(false);
      toast.success("Hallazgo registrado");
    } catch (e) {
      toast.error("No se pudo registrar el hallazgo", { description: mensajeError(e, "Intentá de nuevo.") });
    } finally {
      setEnviando(false);
    }
  };

  const abrirResolver = (r: RegistroScouting) => {
    setResolviendo(r);
    setEspecieResolver(especies[0]?.id ?? "");
  };

  const confirmarResolver = async () => {
    if (!resolviendo || !especieResolver) return;
    try {
      await resolverCtx(resolviendo.id, especieResolver);
      const esp = especies.find((e) => e.id === especieResolver)!;
      toast.success("Hallazgo resuelto", { description: `Matcheado contra ${esp.nombreComun}.` });
      setResolviendo(null);
    } catch (e) {
      toast.error("No se pudo resolver el hallazgo", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  const resolverDialog = (
    <Dialog open={resolviendo !== null} onOpenChange={(v) => !v && setResolviendo(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver hallazgo pendiente</DialogTitle>
          <DialogDescription>
            {resolviendo?.descripcionLibre
              ? `Descripción cargada en campo: "${resolviendo.descripcionLibre}"`
              : "Matcheá el hallazgo contra una especie del catálogo."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Especie del catálogo</Label>
          <Select value={especieResolver} onValueChange={setEspecieResolver}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {especies.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nombreComun} — {e.nombreCientifico} ({e.tipo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button disabled={!especieResolver} onClick={confirmarResolver}>Confirmar match</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isMobile) {
    return (
      <AppShell>
        <MobileScoutingList
          registros={visiblesMobile}
          tipo={tipo}
          onTipo={setTipo}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          onResolver={abrirResolver}
        />
        {resolverDialog}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Scouting agronómico · §08"
        title="Cuaderno de campo"
        description="La especie es una referencia al catálogo, no texto libre: eso habilita umbrales y detección de resistencia."
        actions={
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nuevo hallazgo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo hallazgo</DialogTitle>
                <DialogDescription>
                  Se georreferencia con el GPS del dispositivo y se guarda sin esperar red.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
                  <Label>Especie (catálogo)</Label>
                  <Select value={especieId} onValueChange={setEspecieId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {especies.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombreComun} — {e.nombreCientifico}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {especie ? (
                    <p className="text-xs text-muted-foreground">
                      {etiquetaMetodo[especie.metodo]} ·{" "}
                      {especie.umbralAccion !== null
                        ? `umbral ${especie.umbralAccion} ${especie.unidadMedida}`
                        : "sin umbral publicado"}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor medido{especie ? ` (${especie.unidadMedida})` : ""}</Label>
                  <Input id="valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="3.5" />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold">Sospecha de resistencia</p>
                    <p className="text-xs text-muted-foreground">Se vincula con la última aplicación del lote.</p>
                  </div>
                  <Switch checked={resistencia} onCheckedChange={setResistencia} />
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!loteId || !especie || enviando} onClick={guardar}>
                  {enviando ? "Guardando…" : "Guardar hallazgo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hallazgos" value={String(registros.length)} hint="campaña 2025/26" />
        <Stat
          label="Sobre umbral"
          value={String(registros.filter((r) => r.superaUmbral).length)}
          tone="danger"
        />
        <Stat
          label="Sospechas de resistencia"
          value={String(registros.filter((r) => r.sospechaResistencia).length)}
          tone="warn"
        />
        <Stat label="Fotos en cola" value={String(pendientesFoto)} hint="cola de media independiente" tone={pendientesFoto ? "warn" : "ok"} />
      </section>

      <Tabs value={tipo} onValueChange={(v) => setTipo(v as "todos" | TipoHallazgo)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {TIPOS.map((t) => (
            <TabsTrigger key={t.valor} value={t.valor}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section className="space-y-3">
        <SectionLabel aside={`${visibles.length} registros`}>Hallazgos</SectionLabel>
        {visibles.length === 0 ? (
          <EmptyHint>No hay hallazgos de ese tipo.</EmptyHint>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibles.map((r) => {
              const esp = r.especieId ? especies.find((e) => e.id === r.especieId) : null;
              return (
                <article key={r.id} className="rounded-md border border-border bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg">{esp ? esp.nombreComun : "Sin identificar"}</h2>
                      <p className="truncate text-xs italic text-muted-foreground">
                        {esp ? esp.nombreCientifico : r.descripcionLibre}
                      </p>
                    </div>
                    <SyncBadge estado={r.sync} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {esp ? <Chip tone="ink">{esp.tipo}</Chip> : null}
                    {r.pendienteRevision && puedeGestionar(establecimiento?.rol) ? (
                      <button
                        onClick={() => abrirResolver(r)}
                        className="inline-flex items-center gap-1 rounded-md border border-warn/60 bg-warn/10 px-2 py-1 text-[11px] font-bold text-warn-foreground"
                      >
                        <AlertTriangle className="h-3 w-3" /> pendiente de revisión · resolver
                      </button>
                    ) : r.pendienteRevision ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-warn/60 bg-warn/10 px-2 py-1 text-[11px] font-bold text-warn-foreground">
                        <AlertTriangle className="h-3 w-3" /> pendiente de revisión
                      </span>
                    ) : (
                      <Chip tone={r.superaUmbral ? "danger" : "ok"}>
                        {r.superaUmbral ? "sobre umbral" : "bajo umbral"}
                      </Chip>
                    )}
                    {r.sospechaResistencia ? (
                      <Chip tone="warn">
                        <ShieldAlert className="h-3 w-3" /> resistencia
                      </Chip>
                    ) : null}
                  </div>

                  {esp ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                      <div>
                        <p className="label-field">Valor medido</p>
                        <p className="num mt-1 text-xl">
                          {nf(r.valorMedido)}
                          <span className="ml-1 text-xs text-muted-foreground">{esp.unidadMedida}</span>
                        </p>
                      </div>
                      <div>
                        <p className="label-field">Umbral</p>
                        <p className="num mt-1 text-xl text-muted-foreground">
                          {esp.umbralAccion !== null ? nf(esp.umbralAccion) : "—"}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="truncate">{nombreLote(r.loteId)} · {fechaHora(r.fecha)}</span>
                    <span className="num flex items-center gap-1">
                      <Crosshair className="h-3.5 w-3.5" />
                      {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                    </span>
                  </p>

                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <Camera className="h-4 w-4 shrink-0" />
                    {r.fotos > 0 ? (
                      <button
                        type="button"
                        onClick={() => setGaleriaAbiertaPara(r.id)}
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {r.fotos} foto{r.fotos === 1 ? "" : "s"}
                      </button>
                    ) : (
                      <span>Sin fotos</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionLabel aside={<Link to="/catalogos" className="hover:text-foreground">gestionar catálogos</Link>}>
          Catálogo de especies
        </SectionLabel>
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border">
              <tr className="text-left">
                <th className="label-field p-3">Especie</th>
                <th className="label-field p-3">Tipo</th>
                <th className="label-field p-3">Cuantificación</th>
                <th className="label-field p-3 text-right">Umbral</th>
              </tr>
            </thead>
            <tbody>
              {especies.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <span className="block font-semibold">{e.nombreComun}</span>
                    <span className="block text-xs italic text-muted-foreground">{e.nombreCientifico}</span>
                  </td>
                  <td className="p-3 capitalize text-muted-foreground">{e.tipo}</td>
                  <td className="p-3 text-muted-foreground">{etiquetaMetodo[e.metodo]}</td>
                  <td className="num p-3 text-right">
                    {e.umbralAccion !== null ? `${nf(e.umbralAccion)} ${e.unidadMedida}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {resolverDialog}
      <DialogoFotos
        registroId={galeriaAbiertaPara ?? ""}
        open={galeriaAbiertaPara !== null}
        onOpenChange={(v) => !v && setGaleriaAbiertaPara(null)}
      />
    </AppShell>
  );
}

const TIPO_CHIP: Record<TipoHallazgo, string> = {
  plaga: "bg-[#F5E4DE] text-[#B15A42]",
  maleza: "bg-[#F7EDD9] text-[#A97A2E]",
  enfermedad: "bg-[#E4EEEF] text-[#4E7C8B]",
};

/**
 * Lista móvil de hallazgos — mismo lenguaje visual que la de órdenes.
 * El botón "+" navega a /scouting/nuevo (pantalla completa, ver
 * surco_mobile_flujos.html screen 3), no un Dialog como en escritorio.
 */
function MobileScoutingList({
  registros,
  tipo,
  onTipo,
  busqueda,
  onBusqueda,
  onResolver,
}: {
  registros: RegistroScouting[];
  tipo: "todos" | TipoHallazgo;
  onTipo: (v: "todos" | TipoHallazgo) => void;
  busqueda: string;
  onBusqueda: (v: string) => void;
  onResolver: (r: RegistroScouting) => void;
}) {
  const { establecimiento } = useAuth();
  const { especies } = useCatalogos();
  const { lotes } = useLotes();
  const nombreLote = (id: string) => lotes.find((l) => l.id === id)?.nombre ?? id;
  const [galeriaAbiertaPara, setGaleriaAbiertaPara] = useState<string | null>(null);
  return (
    <div className="-mx-4 -mt-5 sm:-mx-6">
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight">Scouting</h1>
          <Link
            to="/scouting/nuevo"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            aria-label="Nuevo hallazgo"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border-[1.4px] border-border bg-card px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Buscar hallazgo..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              onClick={() => onTipo(t.valor)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border-[1.4px] px-3.5 py-1.5 text-[11.5px] font-semibold",
                tipo === t.valor
                  ? "border-surface-ink bg-surface-ink text-surface-ink-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-5 pt-4">
        {registros.length === 0 ? (
          <EmptyHint>No hay hallazgos que coincidan.</EmptyHint>
        ) : (
          registros.map((r) => {
            const esp = r.especieId ? especies.find((e) => e.id === r.especieId) : null;
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block text-sm font-semibold text-foreground">
                      {esp ? esp.nombreComun : "Hallazgo sin identificar"}
                    </strong>
                    <span className="mt-0.5 block truncate text-[11.5px] italic text-muted-foreground">
                      {esp ? esp.nombreCientifico : r.descripcionLibre}
                    </span>
                  </div>
                  {esp ? (
                    <span className={cn("shrink-0 rounded-md px-2 py-1 text-[10px] font-bold capitalize", TIPO_CHIP[esp.tipo])}>
                      {esp.tipo}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {r.pendienteRevision && puedeGestionar(establecimiento?.rol) ? (
                    <button
                      onClick={() => onResolver(r)}
                      className="inline-flex items-center gap-1 rounded-md bg-[#F7EDD9] px-2 py-1 text-[10px] font-bold text-[#A97A2E]"
                    >
                      <AlertTriangle className="h-3 w-3" /> pendiente de revisión · resolver
                    </button>
                  ) : r.pendienteRevision ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#F7EDD9] px-2 py-1 text-[10px] font-bold text-[#A97A2E]">
                      <AlertTriangle className="h-3 w-3" /> pendiente de revisión
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "rounded-md px-2 py-1 text-[10px] font-bold",
                        r.superaUmbral ? "bg-[#F5E4DE] text-[#B15A42]" : "bg-[#E6F1E8] text-[#4C8F5B]",
                      )}
                    >
                      {r.superaUmbral ? "Sobre umbral" : "Bajo umbral"}
                    </span>
                  )}
                  {r.sospechaResistencia ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#F7EDD9] px-2 py-1 text-[10px] font-bold text-[#A97A2E]">
                      <ShieldAlert className="h-3 w-3" /> Resistencia
                    </span>
                  ) : null}
                </div>

                <p className="mt-2.5 text-[11.5px] text-muted-foreground">
                  {nombreLote(r.loteId)} · {fechaHora(r.fecha)}
                </p>

                <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                  <Camera className="h-3.5 w-3.5 shrink-0" />
                  {r.fotos > 0 ? (
                    <button
                      type="button"
                      onClick={() => setGaleriaAbiertaPara(r.id)}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {r.fotos} foto{r.fotos === 1 ? "" : "s"}
                    </button>
                  ) : (
                    <span>Sin fotos</span>
                  )}
                  {r.fotosPendientes > 0 ? <span>· {r.fotosPendientes} sin subir</span> : null}
                </div>
              </div>
            );
          })
        )}
      </div>
      <DialogoFotos
        registroId={galeriaAbiertaPara ?? ""}
        open={galeriaAbiertaPara !== null}
        onOpenChange={(v) => !v && setGaleriaAbiertaPara(null)}
      />
    </div>
  );
}
