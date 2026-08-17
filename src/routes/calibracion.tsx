import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Gauge, Save, Sprout, Droplets } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { Chip, PageHeader, SectionLabel, Stat } from "@/components/surco/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ajustePorPresion,
  caudalPorBoquilla,
  desvioPct,
  distanciaEntreSemillas,
  dosisReal,
  fechaHora,
  nf,
  nfInt,
  semillasEsperadas,
  superficiePorTanque,
} from "@/lib/surco-data";
import { ApiError } from "@/lib/api-client";
import { useCatalogos } from "@/lib/catalogos-store";
import { useLotes } from "@/lib/lotes-store";
import { useCalibraciones, type NuevaCalibracion } from "@/lib/calibraciones-store";

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

export const Route = createFileRoute("/calibracion")({
  head: () => ({
    meta: [
      { title: "Calibración de maquinaria — Surco" },
      {
        name: "description",
        content:
          "Calculadora offline de pulverizadoras y sembradoras: caudal por boquilla, aforo, ajuste por presión y distancia entre semillas.",
      },
      { property: "og:title", content: "Calibración de maquinaria — Surco" },
      { property: "og:description", content: "Aritmética agronómica en el dispositivo, sin red ni GPS." },
    ],
  }),
  component: CalibracionPage,
});

function Formula({ children }: { children: string }) {
  return (
    <p className="num rounded-sm bg-surface-ink px-3 py-2 text-xs text-surface-ink-foreground">{children}</p>
  );
}

function Resultado({
  label,
  valor,
  unidad,
  tono = "default",
}: {
  label: string;
  valor: string;
  unidad: string;
  tono?: "default" | "warn" | "ok";
}) {
  const color = { default: "text-foreground", warn: "text-warn", ok: "text-ok" }[tono];
  return (
    <div className="rounded-md border border-border bg-secondary/50 p-4">
      <p className="label-field">{label}</p>
      <p className={`num mt-1 text-2xl leading-none sm:text-3xl ${color}`}>
        {valor}
        <span className="ml-1 text-sm text-muted-foreground">{unidad}</span>
      </p>
    </div>
  );
}

function CalibracionPage() {
  const { maquinas, cargando: cargandoCatalogos } = useCatalogos();
  const { lotes, cargando: cargandoLotes } = useLotes();
  const pulverizadoras = maquinas.filter((m) => m.tipo === "pulverizadora");
  const sembradoras = maquinas.filter((m) => m.tipo === "sembradora");

  if (cargandoCatalogos || cargandoLotes) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Cargando máquinas y lotes…</p>
      </AppShell>
    );
  }
  if (pulverizadoras.length === 0 || sembradoras.length === 0) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Utilidades · §06"
          title="Calibración de maquinaria"
          description="Necesitás al menos una pulverizadora y una sembradora cargadas en Catálogos para usar esta calculadora."
        />
      </AppShell>
    );
  }

  return <CalibracionCalculadora maquinas={maquinas} pulverizadoras={pulverizadoras} sembradoras={sembradoras} lotes={lotes} />;
}

function CalibracionCalculadora({
  maquinas,
  pulverizadoras,
  sembradoras,
  lotes,
}: {
  maquinas: ReturnType<typeof useCatalogos>["maquinas"];
  pulverizadoras: ReturnType<typeof useCatalogos>["maquinas"];
  sembradoras: ReturnType<typeof useCatalogos>["maquinas"];
  lotes: ReturnType<typeof useLotes>["lotes"];
}) {
  const { calibraciones: guardadas, guardar: guardarCtx } = useCalibraciones();
  const [enviando, setEnviando] = useState(false);
  const [maquinaId, setMaquinaId] = useState(pulverizadoras[0]!.id);
  const [dosis, setDosis] = useState("120");
  const [velocidad, setVelocidad] = useState("18");
  const [presion1, setPresion1] = useState("3");
  const [presion2, setPresion2] = useState("4");
  const [caudalMedido, setCaudalMedido] = useState("1.62");
  const [boquillas, setBoquillas] = useState("44");
  const [capacidadTanque, setCapacidadTanque] = useState("3200");

  const [sembradoraId, setSembradoraId] = useState(sembradoras[0]!.id);
  const [densidad, setDensidad] = useState("70000");
  const [distanciaMuestra, setDistanciaMuestra] = useState("10");
  const [semillasContadas, setSemillasContadas] = useState("34");

  const [loteId, setLoteId] = useState(lotes[0]?.id ?? "");

  const maquina = maquinas.find((m) => m.id === maquinaId)!;
  const sembradora = maquinas.find((m) => m.id === sembradoraId)!;
  // El catálogo real no siempre trae espaciamiento cargado — 0,52 m es el valor típico de una barra de 44 boquillas.
  const espaciamientoPulv = maquina.espaciamientoM ?? 0.52;
  const espaciamientoSembradora = sembradora.espaciamientoM ?? 0.52;

  const pulv = useMemo(() => {
    const q = caudalPorBoquilla(Number(dosis), Number(velocidad), espaciamientoPulv);
    const qAjustado = ajustePorPresion(q, Number(presion1) || 1, Number(presion2) || 1);
    const medido = Number(caudalMedido);
    const desvio = desvioPct(medido, q);
    const real = dosisReal(medido, Number(velocidad), espaciamientoPulv);
    const sup = superficiePorTanque(Number(capacidadTanque) || 0, Number(dosis));
    const caudalTotal = q * (Number(boquillas) || 0);
    return { q, qAjustado, desvio, real, sup, caudalTotal };
  }, [dosis, velocidad, presion1, presion2, caudalMedido, espaciamientoPulv, capacidadTanque, boquillas]);

  const siembra = useMemo(() => {
    const d = distanciaEntreSemillas(Number(densidad), espaciamientoSembradora);
    const esperadas = semillasEsperadas(Number(distanciaMuestra), d);
    const desvio = desvioPct(Number(semillasContadas), esperadas);
    return { d, esperadas, desvio };
  }, [densidad, distanciaMuestra, semillasContadas, espaciamientoSembradora]);

  const guardar = async (cal: NuevaCalibracion) => {
    setEnviando(true);
    try {
      await guardarCtx(cal);
      const lote = lotes.find((l) => l.id === loteId);
      toast.success("Calibración guardada", {
        description: lote ? `El cálculo se hizo en el dispositivo — se guardó el resultado, referencia ${lote.nombre}.` : "El cálculo se hizo en el dispositivo — se guardó el resultado.",
      });
    } catch (e) {
      toast.error("No se pudo guardar la calibración", { description: mensajeError(e, "Intentá de nuevo.") });
    } finally {
      setEnviando(false);
    }
  };

  const alertaAforo = Math.abs(pulv.desvio) > 10;
  const alertaSiembra = Math.abs(siembra.desvio) > 10;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Utilidades · §06"
        title="Calibración de maquinaria"
        description="Aritmética agronómica ejecutada en el dispositivo: no hay endpoint de cálculo ni dependencia de señal."
        actions={<Chip tone="ink">100 % offline</Chip>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Máquinas cargadas" value={String(maquinas.length)} hint={`${pulverizadoras.length} pulverizadoras`} />
        <Stat label="Calibraciones guardadas" value={String(guardadas.length)} />
        <Stat
          label="Con alerta de desvío"
          value={String(guardadas.filter((c) => c.alerta).length)}
          tone="warn"
          hint="umbral ±10 %"
        />
        <Stat label="Umbral de alerta" value="±10" unit="%" hint="no bloquea el guardado" />
      </section>

      <Tabs defaultValue="pulverizadora">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="pulverizadora">
            <Droplets className="h-4 w-4" /> Pulverizadora
          </TabsTrigger>
          <TabsTrigger value="sembradora">
            <Sprout className="h-4 w-4" /> Sembradora
          </TabsTrigger>
          <TabsTrigger value="historial">
            <Gauge className="h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pulverizadora" className="mt-4 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-md border border-border bg-card p-4">
              <SectionLabel>Parámetros de entrada</SectionLabel>
              <div className="space-y-2">
                <Label>Máquina</Label>
                <Select value={maquinaId} onValueChange={setMaquinaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {pulverizadoras.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="num text-xs text-muted-foreground">
                  {[maquina.marca, maquina.modelo].filter(Boolean).join(" ") || "Sin marca/modelo"} · {nf(espaciamientoPulv, 2)} m entre boquillas
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dosis">Dosis objetivo (L/ha)</Label>
                  <Input id="dosis" inputMode="decimal" value={dosis} onChange={(e) => setDosis(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vel">Velocidad (km/h)</Label>
                  <Input id="vel" inputMode="decimal" value={velocidad} onChange={(e) => setVelocidad(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="boq">Boquillas activas</Label>
                  <Input id="boq" inputMode="numeric" value={boquillas} onChange={(e) => setBoquillas(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanque">Capacidad de tanque (L)</Label>
                  <Input id="tanque" inputMode="numeric" value={capacidadTanque} onChange={(e) => setCapacidadTanque(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p1">Presión actual (bar)</Label>
                  <Input id="p1" inputMode="decimal" value={presion1} onChange={(e) => setPresion1(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p2">Presión nueva (bar)</Label>
                  <Input id="p2" inputMode="decimal" value={presion2} onChange={(e) => setPresion2(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="med">Caudal medido por aforo (L/min)</Label>
                  <Input id="med" inputMode="decimal" value={caudalMedido} onChange={(e) => setCaudalMedido(e.target.value)} />
                </div>
              </div>
              <Formula>Q = (Dosis × Velocidad × Espaciamiento) / 600</Formula>
            </section>

            <section className="space-y-3">
              <SectionLabel aside="cálculo en el dispositivo">Resultados</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <Resultado label="Caudal por boquilla" valor={nf(pulv.q, 2)} unidad="L/min" />
                <Resultado label="Caudal total de barra" valor={nf(pulv.caudalTotal, 1)} unidad="L/min" />
                <Resultado
                  label="Desvío de aforo"
                  valor={`${pulv.desvio > 0 ? "+" : ""}${nf(pulv.desvio)}`}
                  unidad="%"
                  tono={alertaAforo ? "warn" : "ok"}
                />
                <Resultado label="Dosis real aplicada" valor={nf(pulv.real)} unidad="L/ha" />
                <Resultado label={`Caudal a ${presion2} bar`} valor={nf(pulv.qAjustado, 2)} unidad="L/min" />
                <Resultado label="Superficie por tanque" valor={nf(pulv.sup)} unidad="ha" />
              </div>
              {alertaAforo ? (
                <p className="rounded-md border border-warn/60 bg-warn/10 p-3 text-xs text-warn-foreground">
                  Desvío mayor al 10 %: revisar boquillas, filtros o presión. La alerta no bloquea el registro — el dato
                  se guarda igual.
                </p>
              ) : null}
              <div className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-2">
                  <Label>Vincular a lote (opcional)</Label>
                  <Select value={loteId} onValueChange={setLoteId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {lotes.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  disabled={enviando}
                  onClick={() =>
                    guardar({
                      maquinaId,
                      tipoCalculo: "verificacion_aforo",
                      resumen: `${dosis} L/ha · ${velocidad} km/h · ${nf(espaciamientoPulv, 2)} m`,
                      resultado: `${nf(pulv.q, 2)} L/min teórico · desvío ${nf(pulv.desvio)} %`,
                      desvioPct: pulv.desvio,
                      alerta: alertaAforo,
                    })
                  }
                >
                  <Save className="h-4 w-4" /> {enviando ? "Guardando…" : "Guardar calibración"}
                </Button>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="sembradora" className="mt-4 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-md border border-border bg-card p-4">
              <SectionLabel>Parámetros de entrada</SectionLabel>
              <div className="space-y-2">
                <Label>Máquina</Label>
                <Select value={sembradoraId} onValueChange={setSembradoraId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sembradoras.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="num text-xs text-muted-foreground">
                  {[sembradora.marca, sembradora.modelo].filter(Boolean).join(" ") || "Sin marca/modelo"} · {nf(espaciamientoSembradora, 2)} m entre surcos
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dens">Densidad objetivo (semillas/ha)</Label>
                <Input id="dens" inputMode="numeric" value={densidad} onChange={(e) => setDensidad(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dist">Distancia de muestra (m)</Label>
                  <Input id="dist" inputMode="decimal" value={distanciaMuestra} onChange={(e) => setDistanciaMuestra(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cont">Semillas contadas</Label>
                  <Input id="cont" inputMode="numeric" value={semillasContadas} onChange={(e) => setSemillasContadas(e.target.value)} />
                </div>
              </div>
              <Formula>d = 1.000.000 / (Densidad × Espaciamiento)</Formula>
            </section>

            <section className="space-y-3">
              <SectionLabel aside="verificación de siembra">Resultados</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <Resultado label="Distancia entre semillas" valor={nf(siembra.d)} unidad="cm" />
                <Resultado label="Semillas esperadas" valor={nf(siembra.esperadas)} unidad={`en ${distanciaMuestra} m`} />
                <Resultado
                  label="Desvío contado vs. esperado"
                  valor={`${siembra.desvio > 0 ? "+" : ""}${nf(siembra.desvio)}`}
                  unidad="%"
                  tono={alertaSiembra ? "warn" : "ok"}
                />
                <Resultado
                  label="Densidad real estimada"
                  valor={nfInt(
                    (Number(semillasContadas) / Number(distanciaMuestra || 1) / espaciamientoSembradora) * 10000,
                  )}
                  unidad="sem/ha"
                />
              </div>
              {alertaSiembra ? (
                <p className="rounded-md border border-warn/60 bg-warn/10 p-3 text-xs text-warn-foreground">
                  Desvío mayor al 10 %: revisar placas, vacío o velocidad de siembra.
                </p>
              ) : null}
              <Button
                variant="secondary"
                disabled={enviando}
                onClick={() =>
                  guardar({
                    maquinaId: sembradoraId,
                    tipoCalculo: "verificacion_siembra",
                    resumen: `${nfInt(Number(densidad))} sem/ha · ${nf(espaciamientoSembradora, 2)} m`,
                    resultado: `${nf(siembra.d)} cm entre semillas · desvío ${nf(siembra.desvio)} %`,
                    desvioPct: siembra.desvio,
                    alerta: alertaSiembra,
                  })
                }
              >
                <Save className="h-4 w-4" /> {enviando ? "Guardando…" : "Guardar calibración"}
              </Button>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="historial" className="mt-4 space-y-3">
          <SectionLabel aside={`${guardadas.length} registros`}>Calibraciones guardadas</SectionLabel>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {guardadas.map((c) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{maquinas.find((m) => m.id === c.maquinaId)?.nombre}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.tipoCalculo.replace(/_/g, " ")} · {c.resumen}
                  </p>
                  <p className="num mt-1 truncate text-sm">{c.resultado}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {c.alerta ? <Chip tone="warn">alerta de desvío</Chip> : <Chip tone="ok">dentro de rango</Chip>}
                  <span className="num text-[11px] text-muted-foreground">{fechaHora(c.fecha)}</span>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
