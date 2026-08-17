import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useOrdenes } from "@/lib/ordenes-store";
import { useSync } from "@/lib/sync-store";
import { cn } from "@/lib/utils";

/** Enlace a /sync con contador de conflictos + órdenes que requieren revisión — usado en ambas barras de AppShell. */
export function BandejaBadge({ className }: { className?: string }) {
  const { conflictos } = useSync();
  const { ordenes } = useOrdenes();
  const total = conflictos.length + ordenes.filter((o) => o.estado === "requiere_revision").length;

  return (
    <Link to="/sync" aria-label="Bandeja de revisión" className={cn("relative", className)}>
      <Inbox className="h-4 w-4" />
      {total > 0 ? (
        <span className="num absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {total}
        </span>
      ) : null}
    </Link>
  );
}
