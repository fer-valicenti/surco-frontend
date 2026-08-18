import { CloudOff, Droplets, Loader2, Wind } from "lucide-react";
import { descripcionClima, useClima } from "@/lib/clima-store";
import { nfInt } from "@/lib/surco-data";

/** Estado degradado (cargando / sin datos) — misma línea en los dos variants, solo cambian los tokens de color. */
function EstadoClima({ variant, icono: Icono, texto }: { variant: "card" | "sidebar"; icono: typeof Loader2; texto: string }) {
  if (variant === "sidebar") {
    return (
      <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-3 text-xs text-sidebar-foreground/60">
        <Icono className="h-3.5 w-3.5 shrink-0" />
        {texto}
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
      <Icono className="h-4 w-4 shrink-0" />
      {texto}
    </div>
  );
}

export function WidgetClima({ variant }: { variant: "card" | "sidebar" }) {
  const { clima, cargando } = useClima();

  if (cargando) return <EstadoClima variant={variant} icono={Loader2} texto="Cargando clima…" />;
  if (!clima) return <EstadoClima variant={variant} icono={CloudOff} texto="Clima no disponible" />;

  const { Icono, texto } = descripcionClima(clima.codigoClima);

  if (variant === "sidebar") {
    return (
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-3 py-3">
        <Icono className="h-4 w-4 shrink-0 text-sidebar-foreground/80" />
        <span className="num text-sm font-semibold">{nfInt(clima.temperaturaC)}°C</span>
        <span className="truncate text-xs text-sidebar-foreground/60">{texto}</span>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Icono className="h-8 w-8 shrink-0 text-accent" />
      <div className="min-w-0">
        <p className="flex items-baseline gap-1.5">
          <span className="num text-2xl leading-none font-bold">{nfInt(clima.temperaturaC)}°C</span>
          <span className="text-sm text-muted-foreground">{texto}</span>
        </p>
        <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Wind className="h-3.5 w-3.5" /> {nfInt(clima.vientoKmh)} km/h
          </span>
          {clima.probabilidadLluviaHoy !== null ? (
            <span className="flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5" /> {clima.probabilidadLluviaHoy}% hoy
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
