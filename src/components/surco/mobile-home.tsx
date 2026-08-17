import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Droplet, Library, LogOut, Leaf, RefreshCw, Sparkles, Sprout, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-store";
import { useOrdenes } from "@/lib/ordenes-store";
import { useScouting } from "@/lib/scouting-store";
import { useLotes } from "@/lib/lotes-store";
import { cn } from "@/lib/utils";
import { etiquetaLabor, fechaHora, nf } from "@/lib/surco-data";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Home móvil — replica la estructura del mockup de referencia
 * (surco_mobile_home_mockup.html) con datos reales de surco-data.ts en
 * vez de contenido fijo. Solo se usa en mobile (ver index.tsx); desktop
 * sigue con el panel tipo dashboard.
 */
export function MobileHome() {
  const navigate = useNavigate();
  const { usuario, establecimiento, logout } = useAuth();
  const usuarioActual = usuario?.nombre ?? "Invitado";
  const { ordenes } = useOrdenes();
  const { registros: registrosScouting } = useScouting();
  const { lotes } = useLotes();
  const nombreLote = (id: string) => lotes.find((l) => l.id === id)?.nombre ?? id;
  const [syncWidth, setSyncWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setSyncWidth(70), 200);
    return () => clearTimeout(t);
  }, []);

  const cambiosSinSubir =
    lotes.filter((l) => l.sync !== "sincronizado").length +
    ordenes.filter((o) => o.sync !== "sincronizado").length +
    registrosScouting.filter((r) => r.sync !== "sincronizado").length;

  const ordenesDeHoy = ordenes
    .filter((o) => o.estado === "en_curso" || o.estado === "pendiente")
    .slice(0, 3);

  return (
    <div className="-mx-4 -mt-5 sm:-mx-6">
      <header className="rounded-b-3xl bg-gradient-to-br from-surface-ink to-[#1F3D34] px-5 pt-5 pb-6 text-surface-ink-foreground">
        <div className="flex items-center justify-between">
          <div>
            <span className="label-field !text-accent">Establecimiento</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <strong className="font-display text-[17px] font-semibold tracking-tight">
                {establecimiento?.nombre ?? "Sin establecimiento"}
              </strong>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Perfil de ${usuarioActual}`}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-primary font-display text-xs font-bold text-primary-foreground"
              >
                {iniciales(usuarioActual)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="truncate">{usuarioActual}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/catalogos" })}>
                <Library className="h-4 w-4" /> Catálogos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/equipo" })}>
                <Users className="h-4 w-4" /> Equipo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  logout();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="mt-4 flex items-center gap-2 font-display text-[22px] font-semibold tracking-tight">
          Buen día, {usuarioActual.split(" ")[0]}
          <Sprout className="h-[18px] w-[18px] text-accent" />
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-[13.5px] font-semibold">
              {cambiosSinSubir} cambio{cambiosSinSubir === 1 ? "" : "s"} sin subir
            </span>
            <span className="num text-[10.5px] text-white/60">Últ. sync 09:42</span>
          </div>
          <div className="h-[11px] overflow-hidden rounded-full bg-white/[0.08] shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#A34F31] to-primary transition-[width] duration-1000 ease-out"
              style={{ width: `${syncWidth}%` }}
            />
          </div>
          <button className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-primary-foreground transition-transform active:scale-[0.98]">
            <RefreshCw className="h-[15px] w-[15px]" />
            Sincronizar ahora
          </button>
        </div>
      </header>

      <main className="px-5 pt-5">
        <div className="mb-6 grid grid-cols-2 gap-2.5">
          <Link
            to="/ordenes"
            className="relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-primary p-4 text-left text-[13.5px] font-bold text-primary-foreground transition-transform active:scale-[0.97]"
          >
            <Droplet className="h-[30px] w-[30px]" strokeWidth={1.8} />
            <span className="relative z-10">Nueva orden</span>
          </Link>
          <Link
            to="/scouting"
            className="flex flex-col gap-5 rounded-2xl border-[1.5px] border-border bg-card p-4 text-left text-[13.5px] font-bold text-foreground transition-transform active:scale-[0.97]"
          >
            <Leaf className="h-[30px] w-[30px]" strokeWidth={1.8} />
            <span>Registrar hallazgo</span>
          </Link>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <span className="label-field !text-[#A34F31]">Hoy</span>
            <span className="rounded-full bg-foreground/[0.07] px-2.5 py-1 text-[10.5px] font-bold text-foreground/80">
              {ordenesDeHoy.length} activas
            </span>
          </div>

          <div className="space-y-2.5">
            {ordenesDeHoy.map((o) => (
              <Link
                key={o.id}
                to="/ordenes"
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3.5 transition-colors active:border-foreground/20"
              >
                <div
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    o.tipoLabor === "pulverizacion"
                      ? "bg-[#E4EEEF] text-[#4E7C8B]"
                      : "bg-[#F7EDD9] text-[#A97A2E]",
                  )}
                >
                  {o.tipoLabor === "pulverizacion" ? (
                    <Droplet className="h-[19px] w-[19px]" />
                  ) : (
                    <Sparkles className="h-[19px] w-[19px]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold text-foreground">
                    {etiquetaLabor[o.tipoLabor]}
                  </strong>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                    {nombreLote(o.loteId)} · <span className="num">{nf(lotes.find((l) => l.id === o.loteId)?.superficieHa ?? 0)} ha</span>
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-bold",
                      o.estado === "en_curso"
                        ? "bg-[#E4EEEF] text-[#4E7C8B]"
                        : "bg-[#F7EDD9] text-[#A97A2E]",
                    )}
                  >
                    {o.estado === "en_curso" ? "En curso" : "Pendiente"}
                  </span>
                  <span className="num text-[10.5px] text-muted-foreground">
                    {o.fechaInicio ? fechaHora(o.fechaInicio) : "Sin iniciar"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
