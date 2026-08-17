import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRightLeft, History, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useGanaderia } from "@/lib/ganaderia-store";
import { useCatalogos } from "@/lib/catalogos-store";
import { MapaMiniPoligono } from "@/components/surco/mapa-mini";
import { cn } from "@/lib/utils";
import {
  cabezasDeRodeo,
  cargaDePotrero,
  etiquetaMovimiento,
  fechaHora,
  nf,
  nfInt,
  type TipoMovimiento,
} from "@/lib/surco-data";

export const Route = createFileRoute("/ganaderia/$id")({
  component: RodeoDetalle,
});

const TIPOS_MOV: TipoMovimiento[] = ["nacimiento", "compra", "venta", "muerte", "ajuste_conteo"];

function GaugeCargaAnimal({ carga, recomendada }: { carga: number; recomendada: number }) {
  const max = Math.max(recomendada * 1.4, carga * 1.1, 0.1);
  const pctCarga = Math.min(100, (carga / max) * 100);
  const pctRecStart = Math.min(100, ((recomendada * 0.8) / max) * 100);
  const pctRecEnd = Math.min(100, (recomendada / max) * 100);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-surface-ink to-[#1F3D34] p-4 text-surface-ink-foreground">
      <p className="label-field !text-white/60">Carga animal actual</p>
      <p className="num mt-1 flex items-baseline gap-1.5 text-[32px] font-bold leading-none">
        {nf(carga, 2)}
        <span className="text-sm font-semibold text-white/60">EV/ha</span>
      </p>
      <div className="relative mt-4 h-2 rounded-full bg-white/15">
        <div
          className="absolute inset-y-0 rounded-full bg-white/25"
          style={{ left: `${pctRecStart}%`, width: `${Math.max(0, pctRecEnd - pctRecStart)}%` }}
        />
        <div
          className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white", carga > recomendada ? "bg-[#D3764F]" : "bg-[#8FC479]")}
          style={{ left: `calc(${pctCarga}% - 7px)` }}
        />
      </div>
      <div className="num mt-2 flex justify-between text-[10.5px] text-white/60">
        <span>0.0</span>
        <span>Recomendado {nf(recomendada * 0.8, 2)}–{nf(recomendada, 2)}</span>
        <span>{nf(max, 1)}</span>
      </div>
    </div>
  );
}

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

function RodeoDetalle() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { rodeos, movimientosDe, rotacionesDe, registrarMovimiento, moverRodeo } = useGanaderia();
  const { categoriasGanado, potreros } = useCatalogos();
  const [abierto, setAbierto] = useState(false);
  const [tipoMov, setTipoMov] = useState<TipoMovimiento>("nacimiento");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [moverAbierto, setMoverAbierto] = useState(false);
  const [potreroDestino, setPotreroDestino] = useState("");

  const rodeo = rodeos.find((r) => r.id === id);
  if (!rodeo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Este rodeo ya no existe.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/ganaderia" })}>
          Volver a ganadería
        </Button>
      </div>
    );
  }

  const categoria = rodeo.categoriaId ? categoriasGanado.find((c) => c.id === rodeo.categoriaId) : undefined;
  const nombreCategoria = categoria?.nombre ?? (rodeo.categoriaSugerida ? `${rodeo.categoriaSugerida} (sin confirmar)` : "Sin categoría");
  const potrero = potreros.find((p) => p.id === rodeo.potreroId) ?? null;
  const carga = potrero ? cargaDePotrero(potrero, rodeos, categoriasGanado) : 0;
  const cabezas = cabezasDeRodeo(rodeo);
  const potrerosDestino = potreros.filter((p) => p.id !== rodeo.potreroId);
  const rotacionesOrdenadas = [...rotacionesDe(rodeo.id)].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const guardarMovimiento = async () => {
    const n = Number(cantidad);
    if (tipoMov === "ajuste_conteo" ? !n : n <= 0) {
      toast.error(tipoMov === "ajuste_conteo" ? "El ajuste no puede ser 0" : "La cantidad tiene que ser mayor a 0");
      return;
    }
    try {
      await registrarMovimiento(rodeo.id, tipoMov, n, motivo);
      setAbierto(false);
      setCantidad("");
      setMotivo("");
      toast.success("Movimiento registrado", { description: "El stock se recalcula desde el historial." });
    } catch (e) {
      toast.error("No se pudo registrar el movimiento", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  const confirmarTraslado = async () => {
    if (!potreroDestino) {
      toast.error("Elegí el potrero de destino");
      return;
    }
    try {
      const { cargaResultanteEvHa, advertenciaSobrepastoreo } = await moverRodeo(rodeo.id, potreroDestino);
      setMoverAbierto(false);
      setPotreroDestino("");
      const nombreDestino = potreros.find((p) => p.id === potreroDestino)?.nombre;
      if (advertenciaSobrepastoreo) {
        toast.warning("Carga por encima de la recomendada", {
          description: `${rodeo.nombre} ahora está en ${nombreDestino} — ${nf(cargaResultanteEvHa ?? 0, 2)} EV/ha.`,
        });
      } else {
        toast.success("Rodeo trasladado", {
          description: `${rodeo.nombre} ahora está en ${nombreDestino}.`,
        });
      }
    } catch (e) {
      toast.error("No se pudo mover el rodeo", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <button
          onClick={() => navigate({ to: "/ganaderia" })}
          aria-label="Volver"
          className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-card text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <strong className="font-display text-sm text-foreground">{rodeo.nombre}</strong>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">
          {potrero?.nombre ?? "Sin potrero"}
        </span>
      </div>

      <div className="px-5">
        <p className="text-[13px] text-muted-foreground">
          <span className="num">{nfInt(cabezas)}</span> cabezas · {nombreCategoria}
        </p>

        <div className="mt-4">
          <GaugeCargaAnimal carga={carga} recomendada={potrero?.cargaRecomendadaEvHa ?? 1} />
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-card p-3.5">
          <p className="label-field mb-2.5">Composición del rodeo</p>
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-foreground">{nombreCategoria}</span>
            <span className="flex items-center gap-2">
              <span className="num text-muted-foreground">{nfInt(cabezas)} cab.</span>
              <span className="num rounded-md bg-secondary px-1.5 py-0.5 text-[10.5px] font-bold text-secondary-foreground">
                ×{nf(categoria?.ev ?? 0, 1)}
              </span>
            </span>
          </div>
        </div>

        {potrero ? (
          <div className="mt-3 rounded-2xl border border-border bg-card p-3.5">
            <p className="label-field mb-2.5">Potrero</p>
            <MapaMiniPoligono puntos={potrero.poligono} claseAltura="h-[100px]" color="#4E7C8B" />
            <p className="mt-2.5 text-[11.5px] text-muted-foreground">
              Superficie <span className="num">{nf(potrero.superficieHa)} ha</span> · Estado{" "}
              <span className="font-semibold text-foreground">{potrero.estado.replace("_", " ")}</span>
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setAbierto(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.4px] border-border bg-card text-[13.5px] font-bold text-foreground active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Movimiento
          </button>
          <button
            onClick={() => setMoverAbierto(true)}
            disabled={potrerosDestino.length === 0}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.4px] border-border bg-card text-[13.5px] font-bold text-foreground active:scale-[0.98] disabled:opacity-40"
          >
            <ArrowRightLeft className="h-4 w-4" /> Mover a potrero
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-card p-3.5">
          <p className="label-field mb-2.5 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Historial de rotaciones
          </p>
          {rotacionesOrdenadas.length > 0 ? (
            <ul className="space-y-2.5">
              {rotacionesOrdenadas.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="min-w-0 truncate text-foreground">
                    {r.potreroOrigenId ? potreros.find((p) => p.id === r.potreroOrigenId)?.nombre ?? "—" : "Alta"}
                    {" → "}
                    <strong>{potreros.find((p) => p.id === r.potreroDestinoId)?.nombre ?? "—"}</strong>
                  </span>
                  <span className="num shrink-0 text-[11px] text-muted-foreground">{fechaHora(r.fecha)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">Sin rotaciones registradas.</p>
          )}
        </div>
      </div>

      <Dialog open={moverAbierto} onOpenChange={setMoverAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover {rodeo.nombre} a otro potrero</DialogTitle>
            <DialogDescription>
              Queda registrado en el historial de rotaciones{potrero ? ` — sale de ${potrero.nombre}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Potrero de destino</Label>
            <Select value={potreroDestino} onValueChange={setPotreroDestino}>
              <SelectTrigger><SelectValue placeholder="Elegir potrero" /></SelectTrigger>
              <SelectContent>
                {potrerosDestino.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={confirmarTraslado}>Confirmar traslado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimiento en {rodeo.nombre}</DialogTitle>
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
            <Button onClick={guardarMovimiento}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
