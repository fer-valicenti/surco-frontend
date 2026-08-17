import area from "@turf/area";
import booleanIntersects from "@turf/boolean-intersects";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import type { Poligono } from "@/lib/surco-data";

function anilloGeoJson(puntos: Poligono) {
  const anillo = puntos.map(([lat, lng]) => [lng, lat]);
  anillo.push(anillo[0]!);
  return anillo;
}

/** Superficie real en hectáreas — mismo cálculo que ST_Area(geography)/10000 en el backend. */
export function areaHa(puntos: Poligono): number {
  if (puntos.length < 3) return 0;
  return area(polygon([anilloGeoJson(puntos)])) / 10000;
}

/** Equivalente en cliente a ST_Intersects — comparte área, borde o está contenido. */
export function seSuperponen(a: Poligono, b: Poligono): boolean {
  if (a.length < 3 || b.length < 3) return false;
  return booleanIntersects(polygon([anilloGeoJson(a)]), polygon([anilloGeoJson(b)]));
}

/** ¿El punto [lat,lng] cae dentro del polígono? Mismo criterio que calcular_dentro_de_lote en el backend. */
export function puntoDentroDe(lat: number, lng: number, puntos: Poligono): boolean {
  if (puntos.length < 3) return false;
  return booleanPointInPolygon(point([lng, lat]), polygon([anilloGeoJson(puntos)]));
}

// Centro por defecto cuando no hay ningún punto (establecimiento sin lotes/potreros
// todavía) — zona agrícola de Nueve de Julio, Buenos Aires, mismo punto que usa
// onboarding.tsx para el mapa del primer lote. Sin este fallback, centroide([])
// da [NaN, NaN] y Leaflet tira "Invalid LatLng object" al abrir el editor de mapa.
const CENTRO_SIN_DATOS: [number, number] = [-35.445, -60.885];

export function centroide(puntos: Poligono): [number, number] {
  if (puntos.length === 0) return CENTRO_SIN_DATOS;
  const lat = puntos.reduce((acc, p) => acc + p[0], 0) / puntos.length;
  const lng = puntos.reduce((acc, p) => acc + p[1], 0) / puntos.length;
  return [lat, lng];
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

/** [lat,lng][] -> GeoJSON Polygon (anillo cerrado, orden lng/lat) — lo que espera el backend. */
export function aGeoJson(puntos: Poligono): GeoJsonPolygon {
  return { type: "Polygon", coordinates: [anilloGeoJson(puntos)] };
}

/** GeoJSON Polygon -> [lat,lng][] — lo que usa el mapa en el cliente. Descarta el punto de cierre duplicado. */
export function desdeGeoJson(geo: GeoJsonPolygon): Poligono {
  const anillo = geo.coordinates[0] ?? [];
  const sinCierre = anillo.slice(0, -1);
  return sinCierre.map(([lng, lat]) => [lat!, lng!] as [number, number]);
}
