import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { tileLayerOffline, savetiles, getStorageLength, type TileLayerOffline, type ControlSaveTiles } from "leaflet.offline";
import { CloudDownload, LocateFixed, Satellite, Map as MapIcon, Wifi, WifiOff } from "lucide-react";
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

type Basemap = "satelital" | "calles";

// Esri World Imagery: satelital gratuita, sin API key — a diferencia de
// Google/Mapbox, que piden cuenta y facturación por uso. Es la que se usa
// para delimitar el polígono en sí; OSM (calles) queda como alternativa
// para orientarse por nombres de rutas/localidades.
const URL_TILES_SATELITAL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const URL_TILES_CALLES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUCION_SATELITAL = "&copy; Esri, Maxar, Earthstar Geographics";
const ATRIBUCION_CALLES = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

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
 * Mapa real (Leaflet) para dibujar/editar el polígono de un lote o
 * potrero, con capa base intercambiable (satelital/calles) — la satelital
 * es la que realmente permite delimitar contra el borde real del cultivo;
 * la política/calles no muestra nada útil para eso. Los tiles se sirven de
 * IndexedDB si ya se descargaron (leaflet.offline) — funciona sin conexión
 * con lo que se haya guardado antes, para cualquiera de las dos capas.
 * Superficie y superposición se calculan con geometría real (turf), mismo
 * criterio que ST_Area/ST_Intersects en el backend (ver geo.controller.ts).
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
  const capasRef = useRef<Record<Basemap, TileLayerOffline> | null>(null);
  const controlesRef = useRef<Record<Basemap, ControlSaveTiles> | null>(null);
  const marcadorUbicacionRef = useRef<L.CircleMarker | null>(null);
  const circuloPrecisionRef = useRef<L.Circle | null>(null);
  const primeraUbicacionRef = useRef(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [basemap, setBasemap] = useState<Basemap>("satelital");
  const [descargando, setDescargando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [tilesGuardados, setTilesGuardados] = useState<number | null>(null);
  const [ubicacionDisponible, setUbicacionDisponible] = useState(false);

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

    const actualizarTilesGuardados = () => {
      getStorageLength()
        .then(setTilesGuardados)
        .catch(() => {});
    };
    actualizarTilesGuardados();

    const registrarProgreso = (capa: TileLayerOffline) => {
      capa.on("savestart", (e) => {
        setDescargando(true);
        // @ts-expect-error -- leaflet.offline's savestart event carries _tilesforSave, undocumented in the type.
        setProgreso({ actual: 0, total: e._tilesforSave.length });
      });
      capa.on("loadtileend", () => {
        setProgreso((p) => {
          const actual = p.actual + 1;
          if (actual >= p.total) {
            setDescargando(false);
            actualizarTilesGuardados();
          }
          return { ...p, actual };
        });
      });
    };

    const zoomlevels = [zoom - 2, zoom - 1, zoom, zoom + 1].filter((z) => z >= 3 && z <= 19);
    const crearCapa = (url: string, attribution: string) => {
      const capa: TileLayerOffline = tileLayerOffline(url, { attribution, minZoom: 3, maxZoom: 19 });
      registrarProgreso(capa);
      const control = savetiles(capa, {
        zoomlevels,
        confirm: (_status, callback) => callback(),
        confirmRemoval: (_status, callback) => callback(),
      });
      control.addTo(mapa);
      // Necesita pasar por addControl para que Leaflet le asigne this._map
      // (si no, _saveTiles() explota con "Cannot read properties of
      // undefined (reading 'getBounds')") — se oculta su UI nativa porque
      // el botón real vive en el JSX de abajo.
      (control as unknown as { getContainer: () => HTMLElement }).getContainer().style.display = "none";
      return { capa, control };
    };

    const satelital = crearCapa(URL_TILES_SATELITAL, ATRIBUCION_SATELITAL);
    const calles = crearCapa(URL_TILES_CALLES, ATRIBUCION_CALLES);
    capasRef.current = { satelital: satelital.capa, calles: calles.capa };
    controlesRef.current = { satelital: satelital.control, calles: calles.control };
    capasRef.current[basemap].addTo(mapa);

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

    // Ubicación en vivo del dispositivo — punto azul tipo "estás acá" que
    // se actualiza solo, para ubicarse en el campo mientras se camina el
    // perímetro. Solo la primera lectura recentra el mapa; las siguientes
    // actualizan el punto sin mover la vista (si no, cada corrección de GPS
    // te saca del lugar que estabas mirando/dibujando).
    mapa.on("locationfound", (e) => {
      setUbicacionDisponible(true);
      if (!marcadorUbicacionRef.current) {
        circuloPrecisionRef.current = L.circle(e.latlng, {
          radius: e.accuracy,
          color: "#2B6CB0",
          fillColor: "#2B6CB0",
          fillOpacity: 0.12,
          weight: 1,
          interactive: false,
        }).addTo(mapa);
        marcadorUbicacionRef.current = L.circleMarker(e.latlng, {
          radius: 7,
          color: "#FFFFFF",
          weight: 2,
          fillColor: "#2B6CB0",
          fillOpacity: 1,
          interactive: false,
        }).addTo(mapa);
      } else {
        marcadorUbicacionRef.current.setLatLng(e.latlng);
        circuloPrecisionRef.current?.setLatLng(e.latlng).setRadius(e.accuracy);
      }
      if (!primeraUbicacionRef.current) {
        primeraUbicacionRef.current = true;
        mapa.setView(e.latlng, zoom);
      }
    });
    mapa.on("locationerror", () => setUbicacionDisponible(false));
    mapa.locate({ watch: true, enableHighAccuracy: true, setView: false });

    return () => {
      mapa.stopLocate();
      mapa.remove();
      mapaRef.current = null;
      capasRef.current = null;
      controlesRef.current = null;
      marcadorUbicacionRef.current = null;
      circuloPrecisionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centrarEnMiUbicacion = () => {
    const mapa = mapaRef.current;
    const marcador = marcadorUbicacionRef.current;
    if (!mapa || !marcador) return;
    mapa.setView(marcador.getLatLng(), Math.max(mapa.getZoom(), zoom));
  };

  const cambiarBasemap = (tipo: Basemap) => {
    if (tipo === basemap || !mapaRef.current || !capasRef.current) return;
    const mapa = mapaRef.current;
    const capas = capasRef.current;
    if (mapa.hasLayer(capas[basemap])) mapa.removeLayer(capas[basemap]);
    capas[tipo].addTo(mapa);
    // La capa base va siempre atrás — Leaflet apila por orden de adición.
    capas[tipo].bringToBack();
    setBasemap(tipo);
  };

  const descargarZona = () => {
    controlesRef.current?.[basemap]._saveTiles();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={() => cambiarBasemap("satelital")}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold transition-colors",
              basemap === "satelital" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
            )}
          >
            <Satellite className="h-3.5 w-3.5" />
            Satelital
          </button>
          <button
            type="button"
            onClick={() => cambiarBasemap("calles")}
            className={cn(
              "inline-flex items-center gap-1.5 border-l border-border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              basemap === "calles" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
            )}
          >
            <MapIcon className="h-3.5 w-3.5" />
            Calles
          </button>
        </div>
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
      <div className="relative">
        {/* isolate: mismo motivo que mapa-mini.tsx — contiene los z-index internos de Leaflet (400+) dentro de esta card. */}
        <div
          ref={contenedorRef}
          className={cn("isolate w-full overflow-hidden rounded-md border border-border", claseAltura)}
        />
        {ubicacionDisponible ? (
          <button
            type="button"
            onClick={centrarEnMiUbicacion}
            aria-label="Centrar en mi ubicación"
            className="absolute bottom-2.5 right-2.5 z-[1000] grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm"
          >
            <LocateFixed className="h-4 w-4 text-[#2B6CB0]" />
          </button>
        ) : null}
      </div>
      {tilesGuardados !== null ? (
        <p className="text-[11px] text-muted-foreground">{tilesGuardados} tiles guardados en este dispositivo.</p>
      ) : null}
    </div>
  );
}
