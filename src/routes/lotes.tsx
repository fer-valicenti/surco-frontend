import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Layers, Plus, Sprout } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { Chip, PageHeader, SectionLabel, Stat, SyncBadge } from "@/components/surco/bits";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapaEditorPoligono } from "@/components/surco/mapa-editor";
import { MapaMiniPoligono } from "@/components/surco/mapa-mini";
import { centroide } from "@/lib/geo";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useLotes } from "@/lib/lotes-store";
import { useOrdenes } from "@/lib/ordenes-store";
import { useScouting } from "@/lib/scouting-store";
import { nf, puedeGestionar, type Poligono } from "@/lib/surco-data";

export const Route = createFileRoute("/lotes")({
  head: () => ({
    meta: [
      { title: "Lotes y superficie — Surco" },
      {
        name: "description",
        content: "Lotes del establecimiento con superficie calculada del polígono, cultivo y estado de sincronización.",
      },
      { property: "og:title", content: "Lotes y superficie — Surco" },
      { property: "og:description", content: "Polígonos, superficie en hectáreas y campaña de cada lote." },
    ],
  }),
  component: LotesPage,
});

function LotesPage() {
  const { establecimiento } = useAuth();
  const { lotes, crear: crearLote } = useLotes();
  const { ordenes } = useOrdenes();
  const { registros: registrosScouting } = useScouting();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [cultivo, setCultivo] = useState("");
  const [poligono, setPoligono] = useState<Poligono | null>(null);
  const [superficie, setSuperficie] = useState(0);
  const [superpuestos, setSuperpuestos] = useState<{ id: string; nombre: string; puntos: Poligono }[]>([]);

  const total = lotes.reduce((a, l) => a + l.superficieHa, 0);
  const centroMapa = centroide(lotes.flatMap((l) => l.poligono));

  const crear = async () => {
    if (!nombre.trim() || !poligono || poligono.length < 3) {
      toast.error("Faltan datos", { description: "Nombre y polígono son obligatorios." });
      return;
    }
    if (superpuestos.length > 0) {
      toast.error("El polígono se superpone", { description: superpuestos.map((s) => s.nombre).join(", ") });
      return;
    }
    try {
      await crearLote({
        nombre: nombre.trim(),
        poligono,
        cultivoActual: cultivo.trim(),
        campania: "2025/26",
      });
      setAbierto(false);
      setNombre("");
      setCultivo("");
      setPoligono(null);
      setSuperficie(0);
      toast.success("Lote creado", { description: "Ya está disponible en el resto de la app." });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo guardar el lote");
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fundación · §02"
        title="Lotes"
        description="Cada lote es un polígono real: la superficie no se tipea, se deriva de la geometría."
        actions={
          puedeGestionar(establecimiento?.rol) ? (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nuevo lote
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Nuevo lote</DialogTitle>
                <DialogDescription>
                  Dibujá el polígono en el mapa — la superficie se calcula sola, no se tipea.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Lote 6 — El Ceibo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cult">Cultivo actual</Label>
                    <Input id="cult" value={cultivo} onChange={(e) => setCultivo(e.target.value)} placeholder="Soja 2ª" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Polígono</Label>
                  <MapaEditorPoligono
                    centro={centroMapa}
                    poligonosExistentes={lotes.map((l) => ({ id: l.id, nombre: l.nombre, puntos: l.poligono }))}
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
                <Button onClick={crear}>Guardar local</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lotes" value={String(lotes.length)} hint={establecimiento?.partido ?? undefined} />
        <Stat label="Superficie total" value={nf(total)} unit="ha" />
        <Stat label="Promedio por lote" value={nf(lotes.length ? total / lotes.length : 0)} unit="ha" />
        <Stat label="Campaña" value="2025/26" hint="cultivo declarado por lote" />
      </section>

      <section className="space-y-3">
        <SectionLabel aside={`${lotes.filter((l) => l.sync !== "sincronizado").length} sin confirmar`}>
          Detalle de lotes
        </SectionLabel>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lotes.map((l) => {
            const ordenesLote = ordenes.filter((o) => o.loteId === l.id);
            const hallazgos = registrosScouting.filter((r) => r.loteId === l.id);
            return (
              <article key={l.id} className="paper-grid rounded-md border border-border bg-card p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg">{l.nombre}</h2>
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
        </div>
      </section>
    </AppShell>
  );
}
