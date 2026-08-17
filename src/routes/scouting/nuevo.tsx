import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Camera, LocateFixed, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useScouting } from "@/lib/scouting-store";
import { cn } from "@/lib/utils";
import { puntoDentroDe } from "@/lib/geo";
import { type TipoHallazgo } from "@/lib/surco-data";
import { useCatalogos } from "@/lib/catalogos-store";
import { useLotes } from "@/lib/lotes-store";

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

export const Route = createFileRoute("/scouting/nuevo")({
  component: NuevoHallazgo,
});

const TIPOS: { valor: TipoHallazgo; label: string }[] = [
  { valor: "plaga", label: "Plaga" },
  { valor: "maleza", label: "Maleza" },
  { valor: "enfermedad", label: "Enfermedad" },
];

type EstadoGps = "buscando" | "dentro_de_lote" | "fuera_de_lotes" | "denegado" | "no_disponible";

function NuevoHallazgo() {
  const navigate = useNavigate();
  const { guardar } = useScouting();
  const { especies } = useCatalogos();
  const { lotes } = useLotes();

  const [tipo, setTipo] = useState<TipoHallazgo>("maleza");
  const [especieId, setEspecieId] = useState<string | "otra">("");
  const [cobertura, setCobertura] = useState(35);
  const [resistencia, setResistencia] = useState(false);
  const [descripcionLibre, setDescripcionLibre] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [estadoGps, setEstadoGps] = useState<EstadoGps>("buscando");
  const [posicion, setPosicion] = useState<{ lat: number; lng: number } | null>(null);
  const [loteId, setLoteId] = useState("");

  useEffect(() => {
    if (!loteId && lotes.length) setLoteId(lotes[0]!.id);
  }, [lotes, loteId]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setEstadoGps("no_disponible");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosicion({ lat, lng });
        const loteContenedor = lotes.find((l) => puntoDentroDe(lat, lng, l.poligono));
        if (loteContenedor) {
          setLoteId(loteContenedor.id);
          setEstadoGps("dentro_de_lote");
        } else {
          setEstadoGps("fuera_de_lotes");
        }
      },
      (error) => {
        setEstadoGps(error.code === error.PERMISSION_DENIED ? "denegado" : "no_disponible");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const especiesDelTipo = useMemo(() => especies.filter((e) => e.tipo === tipo), [tipo, especies]);
  useEffect(() => {
    if (!especieId && especiesDelTipo.length) setEspecieId(especiesDelTipo[0]!.id);
  }, [especiesDelTipo, especieId]);

  const especie = especieId !== "otra" ? especies.find((e) => e.id === especieId) : null;
  const loteDetectado = lotes.find((l) => l.id === loteId) ?? lotes[0] ?? null;

  const guardarHallazgo = async () => {
    if (especieId === "otra" && !descripcionLibre.trim()) {
      toast.error("Describí el hallazgo para poder marcarlo para revisión");
      return;
    }
    if (!loteDetectado) {
      toast.error("No hay ningún lote cargado para asociar el hallazgo");
      return;
    }
    setEnviando(true);
    try {
      await guardar({
        loteId: loteDetectado.id,
        especieId: especieId === "otra" ? null : especieId,
        descripcionLibre: especieId === "otra" ? descripcionLibre.trim() : null,
        valorMedido: cobertura,
        metodoCuantificacion: especie?.metodo ?? "cobertura",
        sospechaResistencia: resistencia,
      });
      toast.success("Hallazgo registrado", {
        description:
          especieId === "otra"
            ? "Sin match en el catálogo — queda marcado para revisión."
            : "Guardado correctamente.",
      });
      navigate({ to: "/scouting" });
    } catch (e) {
      toast.error("No se pudo registrar el hallazgo", { description: mensajeError(e, "Intentá de nuevo.") });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          onClick={() => navigate({ to: "/scouting" })}
          aria-label="Volver"
          className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-card text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <strong className="font-display text-sm text-foreground">Nuevo hallazgo</strong>
      </div>

      <div className="px-5">
        <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#1F3D34] to-surface-ink">
          <span className="num absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/25 px-2 py-1 text-[10.5px] text-white/90">
            <LocateFixed className={cn("h-3 w-3", estadoGps === "buscando" && "animate-pulse")} />
            {posicion
              ? `${posicion.lat.toFixed(4)}, ${posicion.lng.toFixed(4)}`
              : estadoGps === "buscando"
                ? "Buscando GPS…"
                : "Ubicación no disponible"}
          </span>
          <button
            aria-label="Capturar foto"
            className="grid h-14 w-14 place-items-center rounded-full border-4 border-white/70 bg-white/10 text-white active:scale-95"
          >
            <Camera className="h-6 w-6" />
          </button>
        </div>

        {estadoGps === "dentro_de_lote" && loteDetectado ? (
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#E6F1E8] px-2.5 py-1 text-[11px] font-bold text-[#4C8F5B]">
            ✓ {loteDetectado.nombre} · detectado por GPS
          </span>
        ) : (
          <div className="mt-2.5 space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F7EDD9] px-2.5 py-1 text-[11px] font-bold text-[#A97A2E]">
              <AlertTriangle className="h-3 w-3" />
              {estadoGps === "buscando"
                ? "Obteniendo ubicación…"
                : estadoGps === "fuera_de_lotes"
                  ? "Tu ubicación no coincide con ningún lote — elegilo a mano"
                  : estadoGps === "denegado"
                    ? "Permiso de ubicación denegado — elegí el lote a mano"
                    : "GPS no disponible en este dispositivo — elegí el lote a mano"}
            </span>
            <Select value={loteId} onValueChange={setLoteId}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {lotes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="mt-5">
          <p className="label-field mb-2">Tipo de hallazgo</p>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                onClick={() => {
                  setTipo(t.valor);
                  const primero = especies.find((e) => e.tipo === t.valor);
                  setEspecieId(primero?.id ?? "otra");
                }}
                className={cn(
                  "rounded-xl border-[1.4px] py-2.5 text-[13px] font-semibold",
                  tipo === t.valor
                    ? "border-surface-ink bg-surface-ink text-surface-ink-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="label-field mb-2">Especie</p>
          <select
            value={especieId}
            onChange={(e) => setEspecieId(e.target.value)}
            className="w-full rounded-xl border-[1.4px] border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none"
          >
            {especiesDelTipo.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombreComun} — {e.nombreCientifico}
              </option>
            ))}
            <option value="otra">No está en la lista…</option>
          </select>

          {especieId === "otra" ? (
            <>
              <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-[#F5E4DE] px-3 py-2.5 text-[12px] font-semibold text-[#B15A42]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                No está en la lista — se marca para revisión de un agrónomo
              </div>
              <textarea
                value={descripcionLibre}
                onChange={(e) => setDescripcionLibre(e.target.value)}
                placeholder="Describí lo que ves: hoja, color, tamaño, patrón de daño…"
                rows={3}
                className="mt-2.5 w-full resize-none rounded-xl border-[1.4px] border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="label-field mb-2">
            Cobertura estimada{especie ? ` (${especie.unidadMedida})` : ""}
          </p>
          <div className="flex items-center gap-3 rounded-xl border-[1.4px] border-border bg-card px-3.5 py-2.5">
            <button
              onClick={() => setCobertura((v) => Math.max(0, v - 5))}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"
              aria-label="Restar"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="num flex-1 text-center text-base font-semibold">{cobertura}%</span>
            <button
              onClick={() => setCobertura((v) => Math.min(100, v + 5))}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"
              aria-label="Sumar"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {especie?.umbralAccion != null ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Umbral de acción: {especie.umbralAccion} {especie.unidadMedida}
              {cobertura >= especie.umbralAccion ? " — este valor lo supera" : ""}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border-[1.4px] border-border bg-card px-3.5 py-3">
          <div className="min-w-0 pr-3">
            <p className="text-sm font-semibold text-foreground">Sospecha de resistencia</p>
            <p className="text-[11.5px] text-muted-foreground">Se vincula con la última aplicación del lote.</p>
          </div>
          <Switch checked={resistencia} onCheckedChange={setResistencia} />
        </div>

        <button
          onClick={guardarHallazgo}
          disabled={enviando || !loteDetectado}
          className="mt-6 h-12 w-full rounded-xl bg-primary text-[14px] font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Guardar hallazgo"}
        </button>
      </div>
    </div>
  );
}
