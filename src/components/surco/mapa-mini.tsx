import { useEffect, useRef } from "react";
import L from "leaflet";
import { tileLayerOffline } from "leaflet.offline";
import { cn } from "@/lib/utils";
import type { Poligono } from "@/lib/surco-data";

// Satelital (Esri World Imagery, sin API key) — mismo criterio que
// mapa-editor.tsx: se ve el mismo terreno contra el que se dibujó el
// polígono, no una capa de calles que no aporta nada acá.
const URL_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

interface Props {
  puntos: Poligono;
  claseAltura?: string;
  color?: string;
}

/**
 * Mapa real de solo lectura — usa la misma capa offline que el editor, así
 * que si el área ya se guardó para uso sin conexión, esto también se ve
 * offline. No tiene controles de dibujo ni de zoom (es un thumbnail).
 */
export function MapaMiniPoligono({ puntos, claseAltura = "h-[110px]", color = "#C1603C" }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contenedorRef.current || puntos.length < 3) return;
    const mapa = L.map(contenedorRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      attributionControl: false,
    });

    tileLayerOffline(URL_TILES, { minZoom: 3, maxZoom: 19 }).addTo(mapa);
    const capa = L.polygon(puntos, { color, weight: 2, fillOpacity: 0.25 }).addTo(mapa);
    mapa.fitBounds(capa.getBounds(), { padding: [12, 12] });

    return () => {
      mapa.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (puntos.length < 3) {
    return <div className={cn("rounded-[11px] bg-secondary", claseAltura)} />;
  }

  // isolate: los panes internos de Leaflet usan z-index propios (400+) que,
  // sin esto, escapan del stacking context de esta card y terminan pintando
  // por encima de cualquier Dialog (z-50) abierto en la misma página — bug
  // real visto en producción: el mini-mapa de un lote ya creado se superponía
  // al diálogo "Nuevo lote" en vez de quedar debajo del overlay oscuro.
  return <div ref={contenedorRef} className={cn("isolate overflow-hidden rounded-[11px]", claseAltura)} />;
}
