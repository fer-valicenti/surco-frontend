import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { tileLayerOffline, savetiles, getStorageLength, type TileLayerOffline, type ControlSaveTiles } from "leaflet.offline";
import { CloudDownload, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { areaHa, seSuperponen } from "@/lib/geo";
import type { Poligono } from "@/lib/surco-data";

// El bundler no resuelve los paths relativos que Leaflet espera para sus
// iconos default — fix estándar, ver https://github.com/Leaflet/Leaflet/issues/4968
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const URL_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export interface PoligonoExistente {
  id: string;
  nombre: string;
  puntos: Poligono;
}

interface Props {
  centro: [number, number];
  valorInicial?: Poligono | null;
  poligonosExistentes?: PoligonoExistente[];
  onCambio: (puntos: Poligono | null, areaHa: number, superpuestos: PoligonoExistente[]) => void;
  zoom?: number;
  claseAltura?: string;
}

/**
 * Mapa real (OpenStreetMap vía Leaflet) para dibujar/editar el polígono de
 * un lote o potrero. Los tiles se sirven de IndexedDB si ya se
 * descargaron (leaflet.offline) — funciona sin conexión con lo que se
 * haya guardado antes. Superficie y superposición se calculan con
 * geometría real (turf), mismo criterio que ST_Area/ST_Intersects en el
 * backend (ver geo.controller.ts).
 */
export function MapaEditorPoligono({
  centro,
  valorInicial,
  poligonosExistentes = [],
  onCambio,
  zoom = 15,
  claseAltura = "h-[320px]",
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const saveControlRef = useRef<ControlSaveTiles | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [descargando, setDescargando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [tilesGuardados, setTilesGuardados] = useState<number | null>(null);

  useEffect(() => {
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    window.addEventListener("online", marcarOnline);
    window.addEventListener("offline", marcarOffline);
    return () => {
      window.removeEventListener("online", marcarOnline);
      window.removeEventListener("offline", marcarOffline);
    };
  }, []);

  useEffect(() => {
    if (!contenedorRef.current) return;
    const mapa = L.map(contenedorRef.current).setView(centro, zoom);
    mapaRef.current = mapa;

    const capaBase: TileLayerOffline = tileLayerOffline(URL_TILES, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      minZoom: 3,
      maxZoom: 19,
    }).addTo(mapa);

    getStorageLength()
      .then(setTilesGuardados)
      .catch(() => {});

    const capaExistentes = L.layerGroup().addTo(mapa);
    poligonosExistentes.forEach((p) => {
      if (p.puntos.length < 3) return;
      L.polygon(p.puntos, { color: "#4E7C8B", weight: 1.5, fillOpacity: 0.12, dashArray: "4 3" })
        .bindTooltip(p.nombre, { sticky: true })
        .addTo(capaExistentes);
    });

    mapa.pm.setGlobalOptions({ pathOptions: { color: "#C1603C" } });
    mapa.pm.addControls({
      position: "topright",
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });

    let capaActual: L.Layer | null = null;

    const emitirCambio = (capa: L.Layer | null) => {
      if (!capa) {
        onCambio(null, 0, []);
        return;
      }
      const anillo = ((capa as L.Polygon).getLatLngs()[0] as L.LatLng[]).map((ll) => [ll.lat, ll.lng] as [number, number]);
      const ha = areaHa(anillo);
      const superpuestos = poligonosExistentes.filter((p) => seSuperponen(anillo, p.puntos));
      onCambio(anillo, ha, superpuestos);
    };

    const observarCapa = (capa: L.Layer) => {
      capa.on("pm:edit", () => emitirCambio(capa));
      capa.on("pm:remove", () => {
        capaActual = null;
        onCambio(null, 0, []);
      });
    };

    if (valorInicial && valorInicial.length >= 3) {
      capaActual = L.polygon(valorInicial, { color: "#C1603C" }).addTo(mapa);
      (capaActual as unknown as { pm: { enable: () => void } }).pm.enable();
      observarCapa(capaActual);
      emitirCambio(capaActual);
    }

    mapa.on("pm:create", (e) => {
      if (capaActual) mapa.removeLayer(capaActual);
      capaActual = e.layer;
      observarCapa(capaActual);
      emitirCambio(capaActual);
    });

    const controlGuardado = savetiles(capaBase, {
      zoomlevels: [zoom - 2, zoom - 1, zoom, zoom + 1].filter((z) => z >= 3 && z <= 19),
      confirm: (_status, callback) => callback(),
      confirmRemoval: (_status, callback) => callback(),
    });
    // Necesita pasar por addControl para que Leaflet le asigne this._map
    // (si no, _saveTiles() explota con "Cannot read properties of
    // undefined (reading 'getBounds')") — se oculta su UI nativa porque
    // el botón real vive en el JSX de abajo.
    controlGuardado.addTo(mapa);
    const controlElemento = (controlGuardado as unknown as { getContainer: () => HTMLElement }).getContainer();
    controlElemento.style.display = "none";
    saveControlRef.current = controlGuardado;

    capaBase.on("savestart", (e) => {
      setDescargando(true);
      // @ts-expect-error -- leaflet.offline's savestart event carries _tilesforSave, undocumented in the type.
      setProgreso({ actual: 0, total: e._tilesforSave.length });
    });
    capaBase.on("loadtileend", () => {
      setProgreso((p) => {
        const actual = p.actual + 1;
        if (actual >= p.total) {
          setDescargando(false);
          getStorageLength()
            .then(setTilesGuardados)
            .catch(() => {});
        }
        return { ...p, actual };
      });
    });

    return () => {
      mapa.remove();
      mapaRef.current = null;
      saveControlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const descargarZona = () => {
    saveControlRef.current?._saveTiles();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold",
            online ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn-foreground",
          )}
        >
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {online ? "En línea" : "Sin conexión — usando mapas guardados"}
        </span>
        <button
          type="button"
          onClick={descargarZona}
          disabled={!online || descargando}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground disabled:opacity-50"
        >
          <CloudDownload className="h-3.5 w-3.5" />
          {descargando ? `Descargando ${progreso.actual}/${progreso.total}` : "Guardar zona offline"}
        </button>
      </div>
      {/* isolate: mismo motivo que mapa-mini.tsx — contiene los z-index internos de Leaflet (400+) dentro de esta card. */}
      <div
        ref={contenedorRef}
        className={cn("isolate w-full overflow-hidden rounded-md border border-border", claseAltura)}
      />
      {tilesGuardados !== null ? (
        <p className="text-[11px] text-muted-foreground">{tilesGuardados} tiles guardados en este dispositivo.</p>
      ) : null}
    </div>
  );
}
