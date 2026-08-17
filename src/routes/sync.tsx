import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Lock, MonitorSmartphone, Server } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { EmptyHint, PageHeader, SectionLabel, Stat } from "@/components/surco/bits";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useOrdenes } from "@/lib/ordenes-store";
import { useLotes } from "@/lib/lotes-store";
import { useSync, type EstrategiaResolucion, type OperacionSync, type SyncConflicto } from "@/lib/sync-store";
import { etiquetaLabor, fechaHora, puedeGestionar } from "@/lib/surco-data";

const ETIQUETA_TABLA: Record<string, string> = {
  lotes: "Lote",
  potreros: "Potrero",
  registros_scouting: "Hallazgo de scouting",
  movimientos_stock: "Movimiento de stock",
  eventos_sanitarios: "Evento sanitario",
  calibraciones: "Calibración",
};

const ETIQUETA_OPERACION: Record<OperacionSync, string> = {
  create: "alta",
  update: "modificación",
  delete: "baja",
};

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

function resumenPayload(payload: Record<string, unknown> | null): string {
  if (!payload) return "sin datos (baja)";
  const entradas = Object.entries(payload).filter(([k]) => k !== "id" && k !== "version");
  return entradas.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
}

export const Route = createFileRoute("/sync")({
  head: () => ({
    meta: [
      { title: "Bandeja de revisión — Surco" },
      {
        name: "description",
        content: "Conflictos de sincronización y órdenes que requieren revisión manual, en un solo lugar.",
      },
    ],
  }),
  component: SyncPage,
});

function SyncPage() {
  const { establecimiento } = useAuth();
  const gestiona = puedeGestionar(establecimiento?.rol);
  const { conflictos, resolver } = useSync();
  const { ordenes } = useOrdenes();
  const { lotes } = useLotes();
  const nombreLote = (id: string) => lotes.find((l) => l.id === id)?.nombre ?? id;
  const ordenesRevision = ordenes.filter((o) => o.estado === "requiere_revision");

  const resolverConflicto = async (c: SyncConflicto, estrategia: EstrategiaResolucion) => {
    try {
      await resolver(c.id, estrategia);
      toast.success(
        estrategia === "cliente" ? "Se aplicó el valor del dispositivo" : "Se mantuvo el valor del servidor",
        { description: `${ETIQUETA_TABLA[c.tabla] ?? c.tabla} · ${c.registroId}` },
      );
    } catch (e) {
      toast.error("No se pudo resolver el conflicto", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Sincronización · §05"
        title="Bandeja de revisión"
        description="Todo lo que no se pudo resolver solo: conflictos de sync entre dispositivos y órdenes sin actividad."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {gestiona ? (
          <Stat
            label="Conflictos pendientes"
            value={String(conflictos.length)}
            tone={conflictos.length ? "warn" : "ok"}
          />
        ) : null}
        <Stat
          label="Órdenes por revisar"
          value={String(ordenesRevision.length)}
          tone={ordenesRevision.length ? "danger" : "ok"}
        />
      </section>

      <section className="space-y-3">
        <SectionLabel aside={gestiona ? `${conflictos.length} pendientes` : undefined}>
          Conflictos de sincronización
        </SectionLabel>
        {!gestiona ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            Esta sección es visible para propietario y agrónomo.
          </div>
        ) : conflictos.length === 0 ? (
          <EmptyHint>Sin conflictos — todos los dispositivos están al día.</EmptyHint>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {conflictos.map((c) => (
              <article key={c.id} className="rounded-md border border-warn/60 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-foreground">
                      {ETIQUETA_TABLA[c.tabla] ?? c.tabla} · {ETIQUETA_OPERACION[c.operacion]}
                    </h2>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.registroId} · {c.usuario} · {fechaHora(c.fecha)}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warn/15 px-2 py-1 text-[10px] font-bold text-warn-foreground">
                    <AlertTriangle className="h-3 w-3" /> conflicto
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                  <div className="rounded-md bg-secondary/60 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <Server className="h-3 w-3" /> Servidor
                    </p>
                    <p className="num mt-1 font-semibold text-foreground">versión {c.versionServidor}</p>
                  </div>
                  <div className="rounded-md bg-secondary/60 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <MonitorSmartphone className="h-3 w-3" /> Dispositivo
                    </p>
                    <p className="num mt-1 font-semibold text-foreground">versión {c.versionCliente}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={resumenPayload(c.payloadCliente)}>
                      {resumenPayload(c.payloadCliente)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => resolverConflicto(c, "servidor")}>
                    Mantener servidor
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => resolverConflicto(c, "cliente")}>
                    Usar dispositivo
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionLabel aside={<Link to="/ordenes" className="hover:text-foreground">ver todas</Link>}>
          Órdenes que requieren revisión
        </SectionLabel>
        {ordenesRevision.length === 0 ? (
          <EmptyHint>Sin órdenes pendientes de revisión.</EmptyHint>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {ordenesRevision.map((o) => (
              <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {etiquetaLabor[o.tipoLabor]} · {nombreLote(o.loteId)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {o.id} · sin actividad 12 h{o.dentroDeLoteInicio === false ? " · inicio fuera del lote" : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/ordenes/$id" params={{ id: o.id }}>
                    Revisar <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
