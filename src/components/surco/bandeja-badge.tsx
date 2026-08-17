import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useOrdenes } from "@/lib/ordenes-store";
import { useSync } from "@/lib/sync-store";
import { cn } from "@/lib/utils";

/**
 * Contador de conflictos + órdenes que requieren revisión. Por defecto se
 * renderiza como su propio Link a /sync (barra móvil); con `asIcon` renderiza
 * solo el ícono + contador sin el Link, para poder anidarlo dentro de un
 * link/label ya existente (barra de escritorio) sin anidar <a> dentro de <a>.
 */
export function BandejaBadge({ className, asIcon = false }: { className?: string; asIcon?: boolean }) {
  const { conflictos } = useSync();
  const { ordenes } = useOrdenes();
  const total = conflictos.length + ordenes.filter((o) => o.estado === "requiere_revision").length;

  const contador =
    total > 0 ? (
      <span className="num absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
        {total}
      </span>
    ) : null;

  if (asIcon) {
    return (
      <span className="relative inline-flex shrink-0">
        <Inbox className={className} />
        {contador}
      </span>
    );
  }

  return (
    <Link to="/sync" aria-label="Bandeja de revisión" className={cn("relative", className)}>
      <Inbox className="h-4 w-4" />
      {contador}
    </Link>
  );
}
