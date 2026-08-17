import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPinned,
  Beef,
  Library,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BandejaBadge } from "@/components/surco/bandeja-badge";
import { useAuth } from "@/lib/auth-store";

const NAV = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/lotes", label: "Lotes", icon: MapPinned },
  { to: "/ordenes", label: "Órdenes", icon: ClipboardList },
  { to: "/scouting", label: "Scouting", icon: Leaf },
  { to: "/ganaderia", label: "Ganadería", icon: Beef },
  { to: "/calibracion", label: "Calibración", icon: Gauge },
] as const;

function Marca({ compact = false }: { compact?: boolean }) {
  const { establecimiento } = useAuth();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
        <Leaf className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg leading-none font-bold tracking-tight">Surco</span>
        {!compact ? (
          <span className="block truncate text-[11px] text-sidebar-foreground/60">
            {establecimiento?.nombre ?? "Sin establecimiento"}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function AppShell({
  children,
  hideMobileHeader = false,
}: {
  children: ReactNode;
  /** La home móvil ya trae su propio hero (ver MobileHome) — evita duplicar la barra oscura arriba. */
  hideMobileHeader?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();
  const [online, setOnline] = useState(true);
  const [pendientes, setPendientes] = useState(7);
  const [sincronizando, setSincronizando] = useState(false);

  const sincronizar = () => {
    if (!online) {
      toast.error("Sin conexión", {
        description: "Los cambios quedan en la cola local y se reintenta con backoff.",
      });
      return;
    }
    setSincronizando(true);
    setTimeout(() => {
      setSincronizando(false);
      setPendientes(0);
      toast.success("Sincronización completa", { description: "Push y pull confirmados." });
    }, 1200);
  };

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background">
      {/* Barra lateral — escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Marca />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive(item.to)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-sidebar-border px-4 py-4">
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-sidebar-foreground/80">
            <span className="truncate font-semibold">{usuario?.nombre ?? "Invitado"}</span>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                to="/catalogos"
                aria-label="Catálogos"
                className="rounded-sm p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Library className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/equipo"
                aria-label="Equipo del establecimiento"
                className="rounded-sm p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Users className="h-3.5 w-3.5" />
              </Link>
              <BandejaBadge className="rounded-sm p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
              <button
                onClick={() => {
                  logout();
                  navigate({ to: "/login" });
                }}
                aria-label="Cerrar sesión"
                className="rounded-sm p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setOnline((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-sm bg-sidebar-accent px-3 py-2 text-xs font-semibold text-sidebar-accent-foreground"
          >
            <span className="flex items-center gap-2">
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? "Con señal" : "Sin señal"}
            </span>
            <span className="text-sidebar-foreground/50">cambiar</span>
          </button>
          <div className="flex items-center justify-between text-xs text-sidebar-foreground/70">
            <span className="flex items-center gap-1.5">
              <CloudOff className="h-3.5 w-3.5" />
              cola local
            </span>
            <span className="num">{pendientes}</span>
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={sincronizar}>
            <RefreshCw className={cn("h-4 w-4", sincronizando && "animate-spin")} />
            Sincronizar ahora
          </Button>
        </div>
      </aside>

      {/* Barra superior — móvil */}
      <header
        className={cn(
          "sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden",
          hideMobileHeader && "hidden",
        )}
      >
        <Marca compact />
        <div className="flex shrink-0 items-center gap-2">
          <BandejaBadge className="grid h-9 w-9 place-items-center rounded-sm bg-sidebar-accent text-sidebar-accent-foreground" />
          <button
            onClick={() => setOnline((v) => !v)}
            aria-label="Alternar conectividad"
            className="grid h-9 w-9 place-items-center rounded-sm bg-sidebar-accent text-sidebar-accent-foreground"
          >
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          </button>
          <button
            onClick={sincronizar}
            aria-label="Sincronizar ahora"
            className="relative grid h-9 w-9 place-items-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground"
          >
            <RefreshCw className={cn("h-4 w-4", sincronizando && "animate-spin")} />
            {pendientes > 0 ? (
              <span className="num absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {pendientes}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="px-4 pt-5 pb-28 sm:px-6 lg:ml-60 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
      </main>

      {/* Navegación inferior — móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-card lg:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
