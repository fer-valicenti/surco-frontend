import { useEffect, useRef } from "react";
import L from "leaflet";
import { tileLayerOffline } from "leaflet.offline";
import { cn } from "@/lib/utils";
import type { Poligono } from "@/lib/surco-data";

const URL_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

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

  return <div ref={contenedorRef} className={cn("overflow-hidden rounded-[11px]", claseAltura)} />;
}
