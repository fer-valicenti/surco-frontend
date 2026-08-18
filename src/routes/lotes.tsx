import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Beef, Layers, Plus, Sprout } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { Chip, PageHeader, SectionLabel, Stat, SyncBadge } from "@/components/surco/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapaEditorPoligono } from "@/components/surco/mapa-editor";
import { MapaMiniPoligono } from "@/components/surco/mapa-mini";
import { centroide } from "@/lib/geo";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useLotes } from "@/lib/lotes-store";
import { useCatalogos } from "@/lib/catalogos-store";
import { useOrdenes } from "@/lib/ordenes-store";
import { useScouting } from "@/lib/scouting-store";
import { nf, puedeGestionar, type EstadoPotrero, type Poligono } from "@/lib/surco-data";

export const Route = createFileRoute("/lotes")({
  head: () => ({
    meta: [
      { title: "Parcelas — Surco" },
      {
        name: "description",
        content: "Lotes y potreros del establecimiento con superficie calculada del polígono, uso agrícola o ganadero.",
      },
      { property: "og:title", content: "Parcelas — Surco" },
      { property: "og:description", content: "Polígonos, superficie en hectáreas y uso de cada parcela." },
    ],
  }),
  component: LotesPage,
});

type TipoUso = "agricola" | "ganadero" | "ambos";

const ETIQUETA_ESTADO_POTRERO: Record<EstadoPotrero, string> = {
  disponible: "Disponible",
  en_pastoreo: "En pastoreo",
  en_descanso: "En descanso",
};

function LotesPage() {
  const { establecimiento } = useAuth();
  const { lotes, crear: crearLote } = useLotes();
  const { potreros, agregarPotrero } = useCatalogos();
  const { ordenes } = useOrdenes();
  const { registros: registrosScouting } = useScouting();
  const [abierto, setAbierto] = useState(false);
  const [tipoUso, setTipoUso] = useState<TipoUso>("agricola");
  const [nombre, setNombre] = useState("");
  const [cultivo, setCultivo] = useState("");
  const [carga, setCarga] = useState("");
  const [poligono, setPoligono] = useState<Poligono | null>(null);
  const [superficie, setSuperficie] = useState(0);
  const [superpuestos, setSuperpuestos] = useState<{ id: string; nombre: string; puntos: Poligono }[]>([]);

  const totalAgricola = lotes.reduce((a, l) => a + l.superficieHa, 0);
  const totalGanadero = potreros.reduce((a, p) => a + p.superficieHa, 0);
  const centroMapa = centroide([...lotes, ...potreros].flatMap((p) => p.poligono));

  const poligonosExistentes =
    tipoUso === "agricola"
      ? lotes.map((l) => ({ id: l.id, nombre: l.nombre, puntos: l.poligono }))
      : tipoUso === "ganadero"
        ? potreros.map((p) => ({ id: p.id, nombre: p.nombre, puntos: p.poligono }))
        : [
            ...lotes.map((l) => ({ id: l.id, nombre: l.nombre, puntos: l.poligono })),
            ...potreros.map((p) => ({ id: p.id, nombre: p.nombre, puntos: p.poligono })),
          ];

  const resetForm = () => {
    setAbierto(false);
    setNombre("");
    setCultivo("");
    setCarga("");
    setTipoUso("agricola");
    setPoligono(null);
    setSuperficie(0);
  };

  const crear = async () => {
    const creaLote = tipoUso !== "ganadero";
    const creaPotrero = tipoUso !== "agricola";
    const cargaNum = Number(carga.replace(",", "."));

    if (!nombre.trim() || !poligono || poligono.length < 3) {
      toast.error("Faltan datos", { description: "Nombre y polígono son obligatorios." });
      return;
    }
    if (creaPotrero && !cargaNum) {
      toast.error("Falta la carga recomendada (EV/ha)");
      return;
    }
    if (superpuestos.length > 0) {
      toast.error("El polígono se superpone", { description: superpuestos.map((s) => s.nombre).join(", ") });
      return;
    }

    let loteOk = true;
    let potreroOk = true;
    let error: unknown = null;

    if (creaLote) {
      try {
        await crearLote({ nombre: nombre.trim(), poligono, cultivoActual: cultivo.trim(), campania: "2025/26" });
      } catch (e) {
        loteOk = false;
        error = e;
      }
    }
    if (creaPotrero) {
      try {
        await agregarPotrero({
          nombre: nombre.trim(),
          superficieHa: superficie,
          poligono,
          estado: "disponible",
          cargaRecomendadaEvHa: cargaNum,
        });
      } catch (e) {
        potreroOk = false;
        error = e;
      }
    }

    const todoOk = (!creaLote || loteOk) && (!creaPotrero || potreroOk);
    if (todoOk) {
      toast.success("Parcela creada", { description: "Ya está disponible en el resto de la app." });
      resetForm();
    } else if ((creaLote && loteOk) || (creaPotrero && potreroOk)) {
      toast.error("Se guardó solo una parte de la parcela", {
        description: creaLote && !loteOk ? "El potrero se guardó, el lote no." : "El lote se guardó, el potrero no.",
      });
      resetForm();
    } else {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar la parcela");
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fundación · §02"
        title="Parcelas"
        description="Cada parcela es un polígono real: la superficie no se tipea, se deriva de la geometría. Marcá si es para siembra, ganado, o ambos."
        actions={
          puedeGestionar(establecimiento?.rol) ? (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nueva parcela
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Nueva parcela</DialogTitle>
                <DialogDescription>
                  Dibujá el polígono en el mapa — la superficie se calcula sola, no se tipea.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Uso</Label>
                  <ToggleGroup
                    type="single"
                    value={tipoUso}
                    onValueChange={(v) => v && setTipoUso(v as TipoUso)}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="agricola" aria-label="Agrícola">
                      <Sprout className="h-4 w-4" /> Agrícola
                    </ToggleGroupItem>
                    <ToggleGroupItem value="ganadero" aria-label="Ganadero">
                      <Beef className="h-4 w-4" /> Ganadero
                    </ToggleGroupItem>
                    <ToggleGroupItem value="ambos" aria-label="Ambos">
                      Ambos
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Lote 6 — El Ceibo" />
                  </div>
                  {tipoUso !== "ganadero" ? (
                    <div className="space-y-2">
                      <Label htmlFor="cult">Cultivo actual</Label>
                      <Input id="cult" value={cultivo} onChange={(e) => setCultivo(e.target.value)} placeholder="Soja 2ª" />
                    </div>
                  ) : null}
                  {tipoUso !== "agricola" ? (
                    <div className="space-y-2">
                      <Label htmlFor="carga">Carga recomendada (EV/ha)</Label>
                      <Input id="carga" inputMode="decimal" value={carga} onChange={(e) => setCarga(e.target.value)} placeholder="1,10" />
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Polígono</Label>
                  <MapaEditorPoligono
                    key={tipoUso}
                    centro={centroMapa}
                    poligonosExistentes={poligonosExistentes}
                    onCambio={(puntos, ha, sup) => {
                      setPoligono(puntos);
                      setSuperficie(ha);
                      setSuperpuestos(sup);
                    }}
                  />
                  {poligono ? (
                    <p className="num text-sm text-foreground">
                      {nf(superficie)} ha calculadas
                      {superpuestos.length > 0 ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> se superpone con {superpuestos.map((s) => s.nombre).join(", ")}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={crear}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Parcelas" value={String(lotes.length + potreros.length)} hint={establecimiento?.partido ?? undefined} />
        <Stat label="Superficie total" value={nf(totalAgricola + totalGanadero)} unit="ha" />
        <Stat label="Agrícola" value={nf(totalAgricola)} unit="ha" hint={`${lotes.length} lotes`} />
        <Stat label="Ganadero" value={nf(totalGanadero)} unit="ha" hint={`${potreros.length} potreros`} />
      </section>

      <section className="space-y-3">
        <SectionLabel aside={`${lotes.filter((l) => l.sync !== "sincronizado").length} sin confirmar`}>
          Detalle de parcelas
        </SectionLabel>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lotes.map((l) => {
            const ordenesLote = ordenes.filter((o) => o.loteId === l.id);
            const hallazgos = registrosScouting.filter((r) => r.loteId === l.id);
            return (
              <article key={`lote-${l.id}`} className="paper-grid rounded-md border border-border bg-card p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg">{l.nombre}</h2>
                      <Chip tone="field">
                        <Sprout className="h-3 w-3" /> Agrícola
                      </Chip>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Sprout className="h-3.5 w-3.5" /> {l.cultivoActual} · {l.campania}
                    </p>
                  </div>
                  <SyncBadge estado={l.sync} />
                </div>
                <div className="mt-3">
                  <MapaMiniPoligono puntos={l.poligono} />
                </div>
                <p className="num mt-3 text-3xl leading-none">
                  {nf(l.superficieHa)}
                  <span className="ml-1 text-sm text-muted-foreground">ha</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> superficie derivada del polígono (ST_Area)
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Chip tone="neutral">{ordenesLote.length} órdenes</Chip>
                  <Chip tone={hallazgos.some((h) => h.superaUmbral) ? "danger" : "neutral"}>
                    {hallazgos.length} hallazgos
                  </Chip>
                </div>
              </article>
            );
          })}
          {potreros.map((p) => (
            <article key={`potrero-${p.id}`} className="paper-grid rounded-md border border-border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg">{p.nombre}</h2>
                    <Chip tone="ink">
                      <Beef className="h-3 w-3" /> Ganadero
                    </Chip>
                  </div>
                  <p className="num mt-0.5 text-xs text-muted-foreground">
                    {nf(p.cargaRecomendadaEvHa, 2)} EV/ha recomendada
                  </p>
                </div>
                <Chip tone="neutral">{ETIQUETA_ESTADO_POTRERO[p.estado]}</Chip>
              </div>
              <div className="mt-3">
                <MapaMiniPoligono puntos={p.poligono} />
              </div>
              <p className="num mt-3 text-3xl leading-none">
                {nf(p.superficieHa)}
                <span className="ml-1 text-sm text-muted-foreground">ha</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Layers className="h-3.5 w-3.5" /> superficie derivada del polígono (ST_Area)
              </p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
