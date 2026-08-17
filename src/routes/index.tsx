import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, MapPinned, Syringe } from "lucide-react";
import { AppShell } from "@/components/surco/shell";
import { MobileHome } from "@/components/surco/mobile-home";
import { Chip, PageHeader, SectionLabel, Stat, SyncBadge } from "@/components/surco/bits";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGanaderia } from "@/lib/ganaderia-store";
import { useOrdenes } from "@/lib/ordenes-store";
import { useScouting } from "@/lib/scouting-store";
import { useCatalogos } from "@/lib/catalogos-store";
import { useAuth } from "@/lib/auth-store";
import { useLotes } from "@/lib/lotes-store";
import {
  cabezasDeRodeo,
  cargaDePotrero,
  desvioPct,
  etiquetaEstado,
  etiquetaLabor,
  fechaCorta,
  fechaHora,
  nf,
  nfInt,
} from "@/lib/surco-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Surco — Panel de campo agropecuario" },
      {
        name: "description",
        content:
          "Panel de Surco: órdenes de trabajo, scouting, ganadería y calibración de maquinaria con captura offline-first.",
      },
      { property: "og:title", content: "Surco — Panel de campo agropecuario" },
      {
        property: "og:description",
        content: "Órdenes, scouting, ganadería y calibración en una sola plataforma offline-first.",
      },
    ],
  }),
  component: Panel,
});

function Panel() {
  const isMobile = useIsMobile();
  const { ordenes } = useOrdenes();
  const { rodeos, eventosSanitarios } = useGanaderia();
  const { registros: registrosScouting } = useScouting();
  const { potreros, especies, categoriasGanado } = useCatalogos();
  const { establecimiento } = useAuth();
  const { lotes } = useLotes();
  const nombreEspecie = (id: string | null) =>
    id ? (especies.find((e) => e.id === id)?.nombreComun ?? id) : "Sin identificar";
  const nombreLote = (id: string) => lotes.find((l) => l.id === id)?.nombre ?? id;
  const superficie = lotes.reduce((a, l) => a + l.superficieHa, 0);
  const enCurso = ordenes.filter((o) => o.estado === "en_curso").length;
  const revision = ordenes.filter((o) => o.estado === "requiere_revision").length;
  const cabezas = rodeos.reduce((a, r) => a + cabezasDeRodeo(r), 0);
  const sobreUmbral = registrosScouting.filter((r) => r.superaUmbral);

  const desvios = ordenes
    .flatMap((o) =>
      o.insumos
        .filter((i) => i.aplicada !== null)
        .map((i) => ({ orden: o, insumo: i, pct: desvioPct(i.aplicada!, i.planificada) })),
    )
    .filter((d) => Math.abs(d.pct) >= 5);

  const sobrepastoreo = potreros
    .map((p) => ({ potrero: p, carga: cargaDePotrero(p, rodeos, categoriasGanado) }))
    .filter((x) => x.carga > x.potrero.cargaRecomendadaEvHa);

  const refuerzos = eventosSanitarios.filter((e) => e.proximoRefuerzo);

  if (isMobile) {
    return (
      <AppShell hideMobileHeader>
        <MobileHome />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={[establecimiento?.partido, establecimiento?.provincia].filter(Boolean).join(" · ")}
        title={establecimiento?.nombre ?? "Sin establecimiento"}
        description="Todo lo que se captura en el campo entra acá: primero en el dispositivo, después al servidor."
        actions={
          <Button asChild>
            <Link to="/ordenes">
              Ver órdenes <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Superficie agrícola" value={nf(superficie)} unit="ha" hint={`${lotes.length} lotes`} />
        <Stat label="Labores en curso" value={String(enCurso)} hint={`${revision} para revisar`} tone={revision ? "warn" : "default"} />
        <Stat label="Cabezas totales" value={nfInt(cabezas)} hint={`${rodeos.length} rodeos activos`} />
        <Stat
          label="Hallazgos sobre umbral"
          value={String(sobreUmbral.length)}
          hint="últimos 7 días"
          tone={sobreUmbral.length ? "danger" : "ok"}
        />
      </section>

      <section className="space-y-3">
        <SectionLabel aside="4 reglas de alerta activas">Alertas del establecimiento</SectionLabel>
        <div className="grid gap-3 lg:grid-cols-2">
          {revision > 0 ? (
            <AlertCard
              tone="danger"
              titulo="Órdenes que requieren revisión"
              detalle={ordenes
                .filter((o) => o.estado === "requiere_revision")
                .map((o) => `${o.id} · sin actividad 12 h${o.dentroDeLoteInicio === false ? " · inicio fuera del lote" : ""}`)
                .join(" — ")}
              to="/ordenes"
            />
          ) : null}
          {desvios.map((d) => (
            <AlertCard
              key={`${d.orden.id}-${d.insumo.insumoId}`}
              tone="warn"
              titulo={`Desvío de aplicación ${d.pct > 0 ? "+" : ""}${nf(d.pct)} %`}
              detalle={`${d.orden.id} · planificado ${nfInt(d.insumo.planificada)} ${d.insumo.unidad} vs. aplicado ${nfInt(d.insumo.aplicada!)} ${d.insumo.unidad}`}
              to="/ordenes"
            />
          ))}
          {sobrepastoreo.map((x) => (
            <AlertCard
              key={x.potrero.id}
              tone="warn"
              titulo={`Sobrepastoreo en ${x.potrero.nombre}`}
              detalle={`Carga ${nf(x.carga, 2)} EV/ha sobre una recomendada de ${nf(x.potrero.cargaRecomendadaEvHa, 2)} EV/ha`}
              to="/ganaderia"
            />
          ))}
          {sobreUmbral.map((r) => (
            <AlertCard
              key={r.id}
              tone="danger"
              titulo={`${nombreEspecie(r.especieId)} sobre umbral`}
              detalle={`${nombreLote(r.loteId)} · ${nf(r.valorMedido)} medido${r.sospechaResistencia ? " · sospecha de resistencia" : ""}`}
              to="/scouting"
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <SectionLabel aside={<Link to="/ordenes" className="hover:text-foreground">ver todas</Link>}>
            Actividad reciente
          </SectionLabel>
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {ordenes.map((o) => (
              <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {etiquetaLabor[o.tipoLabor]} · {nombreLote(o.loteId)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {o.id} · {o.fechaInicio ? fechaHora(o.fechaInicio) : "sin iniciar"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
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
                  <SyncBadge estado={o.sync} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <SectionLabel>Estado de potreros y sanidad</SectionLabel>
          <div className="space-y-3">
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {potreros.map((p) => {
                const carga = cargaDePotrero(p, rodeos, categoriasGanado);
                const excede = carga > p.cargaRecomendadaEvHa;
                return (
                  <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 font-semibold">
                        <MapPinned className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{p.nombre}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {nf(p.superficieHa)} ha · recomendada {nf(p.cargaRecomendadaEvHa, 2)} EV/ha
                      </p>
                    </div>
                    <span className={`num shrink-0 text-sm font-semibold ${excede ? "text-destructive" : "text-ok"}`}>
                      {nf(carga, 2)} EV/ha
                    </span>
                  </li>
                );
              })}
            </ul>
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {refuerzos.map((e) => (
                <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-2 font-semibold">
                      <Syringe className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{e.producto}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Aplicado {fechaCorta(e.fecha)} · {rodeos.find((r) => r.id === e.rodeoId)?.nombre}
                    </p>
                  </div>
                  <span className="num shrink-0 text-xs font-semibold text-warn">
                    refuerzo {e.proximoRefuerzo}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function AlertCard({
  tone,
  titulo,
  detalle,
  to,
}: {
  tone: "warn" | "danger";
  titulo: string;
  detalle: string;
  to: "/ordenes" | "/scouting" | "/ganaderia";
}) {
  return (
    <Link
      to={to}
      className={`flex items-start gap-3 rounded-md border bg-card p-4 transition-colors hover:bg-secondary ${
        tone === "danger" ? "border-destructive/50" : "border-warn/60"
      }`}
    >
      <AlertTriangle
        className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "danger" ? "text-destructive" : "text-warn"}`}
      />
      <span className="min-w-0">
        <span className="block font-semibold">{titulo}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{detalle}</span>
      </span>
    </Link>
  );
}
