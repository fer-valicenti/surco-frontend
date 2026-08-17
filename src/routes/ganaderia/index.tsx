import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRightLeft, ChevronRight, ClipboardCheck, Plus, Syringe } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { Chip, PageHeader, SectionLabel, Stat, SyncBadge } from "@/components/surco/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api-client";
import { useGanaderia } from "@/lib/ganaderia-store";
import { useCatalogos } from "@/lib/catalogos-store";
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
} from "@/components/ui/dialog";
import {
  cabezasDeRodeo,
  cargaDePotrero,
  etiquetaMovimiento,
  evDeRodeo,
  fechaCorta,
  nf,
  nfInt,
  type Rodeo,
  type TipoMovimiento,
} from "@/lib/surco-data";

export const Route = createFileRoute("/ganaderia/")({
  head: () => ({
    meta: [
      { title: "Gestión ganadera — Surco" },
      {
        name: "description",
        content:
          "Stock derivado de movimientos, rotación de potreros con validación de carga animal en EV/ha y calendario sanitario.",
      },
      { property: "og:title", content: "Gestión ganadera — Surco" },
      { property: "og:description", content: "Rodeos, movimientos de stock, carga animal y eventos sanitarios." },
    ],
  }),
  component: GanaderiaPage,
});

const TIPOS_MOV: TipoMovimiento[] = ["nacimiento", "compra", "venta", "muerte", "ajuste_conteo"];

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

function GanaderiaPage() {
  const isMobile = useIsMobile();
  const {
    rodeos,
    eventosSanitarios,
    movimientosDe,
    registrarMovimiento: registrarMovimientoCtx,
    moverRodeo: moverRodeoCtx,
  } = useGanaderia();
  const { categoriasGanado, potreros } = useCatalogos();
  const nombrePotrero = (id: string | null) => (id ? (potreros.find((p) => p.id === id)?.nombre ?? id) : "Sin potrero");
  const [movDe, setMovDe] = useState<Rodeo | null>(null);
  const [moverDe, setMoverDe] = useState<Rodeo | null>(null);
  const [tipoMov, setTipoMov] = useState<TipoMovimiento>("nacimiento");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [destino, setDestino] = useState("");

  useEffect(() => {
    if (!destino && potreros.length) setDestino(potreros[0]!.id);
  }, [potreros, destino]);

  const totalCabezas = rodeos.reduce((a, r) => a + cabezasDeRodeo(r), 0);
  const totalEv = rodeos.reduce((a, r) => a + evDeRodeo(r, categoriasGanado), 0);
  const haGanadera = potreros.reduce((a, p) => a + p.superficieHa, 0);

  const registrarMovimiento = async () => {
    if (!movDe) return;
    const n = Number(cantidad);
    if (tipoMov === "ajuste_conteo" ? !n : n <= 0) {
      toast.error(tipoMov === "ajuste_conteo" ? "El ajuste no puede ser 0" : "La cantidad tiene que ser mayor a 0");
      return;
    }
    try {
      await registrarMovimientoCtx(movDe.id, tipoMov, n, motivo);
      setMovDe(null);
      setCantidad("");
      setMotivo("");
      toast.success("Movimiento registrado", { description: "El stock se recalcula desde el historial." });
    } catch (e) {
      toast.error("No se pudo registrar el movimiento", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  const moverRodeo = async () => {
    if (!moverDe || !destino) return;
    const destinoPot = potreros.find((p) => p.id === destino)!;
    try {
      const { cargaResultanteEvHa, advertenciaSobrepastoreo } = await moverRodeoCtx(moverDe.id, destino);
      setMoverDe(null);
      if (advertenciaSobrepastoreo) {
        toast.warning("Carga por encima de la recomendada", {
          description: `${destinoPot.nombre} queda en ${nf(cargaResultanteEvHa ?? 0, 2)} EV/ha (recomendada ${nf(destinoPot.cargaRecomendadaEvHa, 2)}).`,
        });
      } else {
        toast.success("Rodeo movido", {
          description:
            cargaResultanteEvHa !== null
              ? `${destinoPot.nombre} queda en ${nf(cargaResultanteEvHa, 2)} EV/ha.`
              : `${destinoPot.nombre} no tiene superficie cargada — no se pudo calcular la carga.`,
        });
      }
    } catch (e) {
      toast.error("No se pudo mover el rodeo", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  if (isMobile) {
    return (
      <AppShell>
        <MobileRodeosList rodeos={rodeos} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Ganadería · §07"
        title="Stock, potreros y sanidad"
        description="Las cabezas no se editan: son la suma del historial de movimientos, como el saldo de una cuenta."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cabezas totales" value={nfInt(totalCabezas)} hint={`${rodeos.length} rodeos`} />
        <Stat label="Equivalente vaca" value={nf(totalEv)} unit="EV" />
        <Stat label="Superficie ganadera" value={nf(haGanadera)} unit="ha" />
        <Stat
          label="Carga general"
          value={nf(totalEv / haGanadera, 2)}
          unit="EV/ha"
          tone={totalEv / haGanadera > 1 ? "warn" : "ok"}
        />
      </section>

      <Tabs defaultValue="rodeos">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="rodeos">Rodeos</TabsTrigger>
          <TabsTrigger value="potreros">Potreros</TabsTrigger>
          <TabsTrigger value="sanidad">Sanidad</TabsTrigger>
        </TabsList>

        <TabsContent value="rodeos" className="mt-4 space-y-3">
          <SectionLabel aside="stock derivado de movimientos_stock">Rodeos activos</SectionLabel>
          <div className="grid gap-3 lg:grid-cols-2">
            {rodeos.map((r) => {
              const cat = r.categoriaId ? categoriasGanado.find((c) => c.id === r.categoriaId) : undefined;
              const nombreCategoria = cat?.nombre ?? (r.categoriaSugerida ? `${r.categoriaSugerida} (sin confirmar)` : "Sin categoría");
              const movs = movimientosDe(r.id);
              return (
                <article key={r.id} className="rounded-md border border-border bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg">{r.nombre}</h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {nombreCategoria}
                        {cat ? ` · EV ${nf(cat.ev, 1)}` : ""} · {nombrePotrero(r.potreroId)}
                      </p>
                    </div>
                    <SyncBadge estado={r.sync} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="label-field">Cabezas</p>
                      <p className="num mt-1 text-3xl leading-none">{nfInt(cabezasDeRodeo(r))}</p>
                    </div>
                    <div>
                      <p className="label-field">Equivalente vaca</p>
                      <p className="num mt-1 text-3xl leading-none text-muted-foreground">{nf(evDeRodeo(r, categoriasGanado))}</p>
                    </div>
                  </div>

                  <details className="mt-4 border-t border-border pt-3">
                    <summary className="label-field cursor-pointer select-none">
                      Historial de movimientos ({movs.length})
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {movs.map((m) => (
                        <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs">
                          <span className="min-w-0 truncate text-muted-foreground">
                            {fechaCorta(m.fecha)} · {etiquetaMovimiento[m.tipo]}
                            {m.motivo ? ` — ${m.motivo}` : ""}
                          </span>
                          <span
                            className={`num shrink-0 font-semibold ${
                              m.tipo === "nacimiento" || m.tipo === "compra" || (m.tipo === "ajuste_conteo" && m.cantidad > 0)
                                ? "text-ok"
                                : "text-destructive"
                            }`}
                          >
                            {m.tipo === "ajuste_conteo"
                              ? (m.cantidad > 0 ? "+" : "−")
                              : m.tipo === "nacimiento" || m.tipo === "compra"
                                ? "+"
                                : "−"}
                            {Math.abs(m.cantidad)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button size="sm" onClick={() => setMovDe(r)}>
                      <Plus className="h-4 w-4" /> Movimiento
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setMoverDe(r)}>
                      <ArrowRightLeft className="h-4 w-4" /> Mover de potrero
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="rounded-md border border-border bg-secondary/60 p-4">
            <p className="label-field flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Verificación por conteo físico
            </p>
            <p className="num mt-2 text-sm">
              Cantidad esperada = cantidad anterior + Σ altas − Σ bajas
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Si el conteo real difiere, la diferencia entra como <strong>ajuste de conteo</strong> con su motivo — nunca
              se sobreescribe el stock.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="potreros" className="mt-4 space-y-3">
          <SectionLabel aside="carga instantánea en EV/ha">Potreros</SectionLabel>
          <div className="grid gap-3 lg:grid-cols-2">
            {potreros.map((p) => {
              const carga = cargaDePotrero(p, rodeos, categoriasGanado);
              const pct = Math.min(150, (carga / p.cargaRecomendadaEvHa) * 100);
              const excede = carga > p.cargaRecomendadaEvHa;
              return (
                <article key={p.id} className="rounded-md border border-border bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg">{p.nombre}</h2>
                      <p className="text-xs text-muted-foreground">{nf(p.superficieHa)} ha</p>
                    </div>
                    <Chip tone={p.estado === "en_pastoreo" ? "field" : p.estado === "en_descanso" ? "neutral" : "ok"}>
                      {p.estado.replace("_", " ")}
                    </Chip>
                  </div>
                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <div className="min-w-0">
                      <p className="label-field">Carga actual</p>
                      <p className={`num mt-1 text-3xl leading-none ${excede ? "text-destructive" : "text-ok"}`}>
                        {nf(carga, 2)}
                        <span className="ml-1 text-sm text-muted-foreground">EV/ha</span>
                      </p>
                    </div>
                    <p className="num shrink-0 text-xs text-muted-foreground">
                      recom. {nf(p.cargaRecomendadaEvHa, 2)}
                    </p>
                  </div>
                  <Progress value={pct} className="mt-3" />
                  <p className="mt-3 truncate text-xs text-muted-foreground">
                    Rodeos:{" "}
                    {rodeos.filter((r) => r.potreroId === p.id).map((r) => r.nombre).join(", ") || "sin ocupación"}
                  </p>
                </article>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="sanidad" className="mt-4 space-y-3">
          <SectionLabel aside="alertas de próximo refuerzo">Eventos sanitarios</SectionLabel>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="border-b border-border">
                <tr className="text-left">
                  <th className="label-field p-3">Producto</th>
                  <th className="label-field p-3">Tipo</th>
                  <th className="label-field p-3">Rodeo</th>
                  <th className="label-field p-3">Fecha</th>
                  <th className="label-field p-3 text-right">Próximo refuerzo</th>
                </tr>
              </thead>
              <tbody>
                {eventosSanitarios.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-semibold">
                      <span className="flex items-center gap-2">
                        <Syringe className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {e.producto}
                      </span>
                    </td>
                    <td className="p-3 capitalize text-muted-foreground">{e.tipo}</td>
                    <td className="p-3 text-muted-foreground">
                      {rodeos.find((r) => r.id === e.rodeoId)?.nombre}
                    </td>
                    <td className="num p-3 text-muted-foreground">{fechaCorta(e.fecha)}</td>
                    <td className="num p-3 text-right">
                      {e.proximoRefuerzo ? (
                        <span className="font-semibold text-warn">{e.proximoRefuerzo}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionLabel>Equivalencia vaca — referencia</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categoriasGanado.map((c) => (
              <div key={c.id} className="rounded-md border border-border bg-card p-3">
                <p className="num text-2xl leading-none">{nf(c.ev, 1)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.nombre}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Movimiento de stock */}
      <Dialog open={!!movDe} onOpenChange={(v) => !v && setMovDe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimiento en {movDe?.nombre}</DialogTitle>
            <DialogDescription>La cantidad siempre es positiva: el signo lo da el tipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipoMov} onValueChange={(v) => setTipoMov(v as TipoMovimiento)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MOV.map((t) => (
                    <SelectItem key={t} value={t}>{etiquetaMovimiento[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantmov">Cantidad</Label>
              <Input id="cantmov" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="3" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Parición de agosto" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={registrarMovimiento}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotación de potrero */}
      <Dialog open={!!moverDe} onOpenChange={(v) => !v && setMoverDe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover {moverDe?.nombre}</DialogTitle>
            <DialogDescription>Se valida la carga resultante del potrero destino antes de confirmar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Potrero destino</Label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {potreros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — {nf(p.superficieHa)} ha
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={moverRodeo}>Confirmar traslado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/**
 * Lista móvil de rodeos — tarjetas compactas que navegan al detalle
 * (/ganaderia/$id, ver surco_mobile_flujos_2.html screen 6).
 */
function MobileRodeosList({ rodeos }: { rodeos: Rodeo[] }) {
  const { categoriasGanado, potreros } = useCatalogos();
  const nombrePotrero = (id: string | null) => (id ? (potreros.find((p) => p.id === id)?.nombre ?? id) : "Sin potrero");
  return (
    <div className="-mx-4 -mt-5 sm:-mx-6">
      <div className="px-5 pt-5">
        <h1 className="font-display text-xl font-semibold tracking-tight">Ganadería</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {nfInt(rodeos.reduce((a, r) => a + cabezasDeRodeo(r), 0))} cabezas · {rodeos.length} rodeos
        </p>
      </div>

      <div className="space-y-2.5 px-5 pt-4">
        {rodeos.map((r) => {
          const cat = r.categoriaId ? categoriasGanado.find((c) => c.id === r.categoriaId) : undefined;
          const nombreCategoria = cat?.nombre ?? (r.categoriaSugerida ? `${r.categoriaSugerida} (sin confirmar)` : "Sin categoría");
          const potrero = potreros.find((p) => p.id === r.potreroId);
          const carga = potrero ? cargaDePotrero(potrero, rodeos, categoriasGanado) : null;
          const excede = carga !== null && potrero ? carga > potrero.cargaRecomendadaEvHa : false;
          return (
            <Link
              key={r.id}
              to="/ganaderia/$id"
              params={{ id: r.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3.5 transition-colors active:border-foreground/20"
            >
              <div className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold text-foreground">{r.nombre}</strong>
                <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                  {nombreCategoria} · {nombrePotrero(r.potreroId)}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="num text-sm font-semibold text-foreground">{nfInt(cabezasDeRodeo(r))} cab.</span>
                {carga !== null ? (
                  <span className={`num text-[10.5px] ${excede ? "text-destructive" : "text-muted-foreground"}`}>
                    {nf(carga, 2)} EV/ha
                  </span>
                ) : null}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
