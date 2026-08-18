import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";

const URL_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const URL_FORECAST = "https://api.open-meteo.com/v1/forecast";
const INTERVALO_REFRESCO_MS = 10 * 60 * 1000;

export interface ClimaActual {
  temperaturaC: number;
  vientoKmh: number;
  codigoClima: number;
  probabilidadLluviaHoy: number | null;
}

interface DescripcionClima {
  Icono: LucideIcon;
  texto: string;
}

/** Códigos WMO (weathercode de Open-Meteo) agrupados por rango — https://open-meteo.com/en/docs */
export function descripcionClima(codigo: number): DescripcionClima {
  if (codigo === 0) return { Icono: Sun, texto: "Despejado" };
  if (codigo <= 2) return { Icono: CloudSun, texto: "Parcialmente nublado" };
  if (codigo === 3) return { Icono: Cloud, texto: "Nublado" };
  if (codigo === 45 || codigo === 48) return { Icono: CloudFog, texto: "Niebla" };
  if (codigo >= 51 && codigo <= 57) return { Icono: CloudDrizzle, texto: "Llovizna" };
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return { Icono: CloudRain, texto: "Lluvia" };
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return { Icono: CloudSnow, texto: "Nieve" };
  if (codigo >= 95) return { Icono: CloudLightning, texto: "Tormenta" };
  return { Icono: Cloud, texto: "Sin datos" };
}

interface GeocodingApi {
  results?: { latitude: number; longitude: number }[];
}

interface ForecastApi {
  current_weather: { temperature: number; windspeed: number; weathercode: number };
  daily?: { precipitation_probability_max?: number[] };
}

interface ClimaContextValue {
  clima: ClimaActual | null;
  cargando: boolean;
}

const ClimaContext = createContext<ClimaContextValue | null>(null);

/** Mismo patrón "mejor esfuerzo" que scouting-store.tsx: nunca rechaza, resuelve null si no hay GPS o el usuario lo deniega. */
function obtenerPosicionGps(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

/**
 * Clima vía Open-Meteo (sin API key, CORS habilitado) — primera llamada
 * directa a una API externa desde este frontend, no pasa por el backend de
 * Surco. Ubicación: GPS del dispositivo primero (más preciso, esencial en
 * mobile); si no hay GPS o el usuario lo deniega, cae a geocodificar
 * partido/provincia del establecimiento. Si ambas fallan, `clima` queda en
 * null — el widget lo trata como "no disponible", nunca como error.
 */
export function ClimaProvider({ children }: { children: ReactNode }) {
  const { establecimiento } = useAuth();
  const [clima, setClima] = useState<ClimaActual | null>(null);
  const [cargando, setCargando] = useState(true);
  const coordenadasRef = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!establecimiento) {
      setCargando(false);
      return;
    }

    let cancelado = false;
    coordenadasRef.current = null;

    const resolverCoordenadas = async () => {
      if (coordenadasRef.current) return coordenadasRef.current;

      const gps = await obtenerPosicionGps();
      if (gps) {
        coordenadasRef.current = gps;
        return gps;
      }

      if (!establecimiento.partido) throw new Error("sin GPS ni partido para ubicar");
      const nombre = establecimiento.provincia
        ? `${establecimiento.partido}, ${establecimiento.provincia}`
        : establecimiento.partido;
      const url = new URL(URL_GEOCODING);
      url.searchParams.set("name", nombre);
      url.searchParams.set("count", "1");
      url.searchParams.set("language", "es");
      url.searchParams.set("format", "json");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("geocoding falló");
      const body = (await res.json()) as GeocodingApi;
      const primero = body.results?.[0];
      if (!primero) throw new Error("sin resultados de geocoding");
      const coords = { lat: primero.latitude, lon: primero.longitude };
      coordenadasRef.current = coords;
      return coords;
    };

    const refrescarClima = async () => {
      try {
        const { lat, lon } = await resolverCoordenadas();
        const url = new URL(URL_FORECAST);
        url.searchParams.set("latitude", String(lat));
        url.searchParams.set("longitude", String(lon));
        url.searchParams.set("current_weather", "true");
        url.searchParams.set("daily", "precipitation_probability_max");
        url.searchParams.set("timezone", "auto");
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("forecast falló");
        const body = (await res.json()) as ForecastApi;
        if (cancelado) return;
        setClima({
          temperaturaC: body.current_weather.temperature,
          vientoKmh: body.current_weather.windspeed,
          codigoClima: body.current_weather.weathercode,
          probabilidadLluviaHoy: body.daily?.precipitation_probability_max?.[0] ?? null,
        });
      } catch {
        if (!cancelado) setClima(null);
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    setCargando(true);
    refrescarClima();
    const intervalo = setInterval(refrescarClima, INTERVALO_REFRESCO_MS);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [establecimiento?.id]);

  return <ClimaContext.Provider value={{ clima, cargando }}>{children}</ClimaContext.Provider>;
}

export function useClima() {
  const ctx = useContext(ClimaContext);
  if (!ctx) throw new Error("useClima tiene que usarse dentro de <ClimaProvider>");
  return ctx;
}
