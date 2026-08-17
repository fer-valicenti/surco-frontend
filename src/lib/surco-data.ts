// Tipos de dominio y lógica de cálculo de Surco. Los datos en sí viven
// en el backend real — ver los *-store.tsx en este mismo directorio.

export type Rol = "propietario" | "agronomo" | "operario";

/** Frontera real de permisos hoy: propietario y agrónomo gestionan estructura/equipo por igual, operario queda afuera. */
export function puedeGestionar(rol: Rol | undefined): boolean {
  return rol === "propietario" || rol === "agronomo";
}
export type EstadoOrden =
  | "pendiente"
  | "en_curso"
  | "finalizada"
  | "cancelada"
  | "requiere_revision";
export type TipoLabor = "siembra" | "pulverizacion" | "fertilizacion" | "cosecha";
export type TipoHallazgo = "plaga" | "maleza" | "enfermedad";
export type MetodoCuantificacion = "conteo_area" | "cobertura" | "incidencia_severidad";
export type EstadoPotrero = "disponible" | "en_pastoreo" | "en_descanso";
export type TipoMovimiento =
  | "nacimiento"
  | "compra"
  | "venta"
  | "muerte"
  | "traslado_entrada"
  | "traslado_salida"
  | "ajuste_conteo";
export type EstadoSync = "pendiente" | "sincronizado" | "conflicto";

export interface Establecimiento {
  id: string;
  nombre: string;
  cuit: string;
  provincia: string;
  partido: string;
}

/** [lat, lng] — anillo del polígono real, sin repetir el primer punto al final. */
export type Poligono = [number, number][];

export interface Lote {
  id: string;
  nombre: string;
  superficieHa: number;
  poligono: Poligono;
  cultivoActual: string;
  campania: string;
  sync: EstadoSync;
}

export type TipoInsumo = "fitosanitario" | "fertilizante" | "semilla" | "otro";

export interface Insumo {
  id: string;
  nombre: string;
  tipo: TipoInsumo;
  unidad: string;
}

export interface OrdenInsumo {
  insumoId: string;
  planificada: number;
  aplicada: number | null;
  unidad: string;
}

export interface HistorialEstado {
  estadoAnterior: EstadoOrden | null;
  estadoNuevo: EstadoOrden;
  fecha: string;
  usuario: string;
}

export interface OrdenTrabajo {
  id: string;
  loteId: string;
  tipoLabor: TipoLabor;
  // uuid de un Usuario real, o null si no se asignó — ya no es un nombre
  // libre (ver §29, todavía sin equipo real conectado a este dominio).
  asignadoA: string | null;
  estado: EstadoOrden;
  fechaInicio: string | null;
  fechaFin: string | null;
  dentroDeLoteInicio: boolean | null;
  insumos: OrdenInsumo[];
  historial: HistorialEstado[];
  sync: EstadoSync;
  // Control de concurrencia optimista del backend — ausente en los datos
  // de ejemplo estáticos, siempre presente en lo que llega de la API real.
  version?: number;
}

export interface Especie {
  id: string;
  tipo: TipoHallazgo;
  nombreComun: string;
  nombreCientifico: string;
  metodo: MetodoCuantificacion;
  umbralAccion: number | null;
  unidadMedida: string;
}

export interface RegistroScouting {
  id: string;
  loteId: string;
  // Nullable — patrón "alerta, no bloqueo" (ver CLAUDE.md §8): sin match
  // en el catálogo, el hallazgo igual se guarda con descripcionLibre +
  // pendienteRevision, en vez de bloquear la carga.
  especieId: string | null;
  descripcionLibre: string | null;
  pendienteRevision: boolean;
  fecha: string;
  valorMedido: number;
  superaUmbral: boolean;
  sospechaResistencia: boolean;
  fotos: number;
  fotosPendientes: number;
  lat: number;
  lng: number;
  sync: EstadoSync;
}

export interface CategoriaGanado {
  id: string;
  nombre: string;
  ev: number;
}

export interface Potrero {
  id: string;
  nombre: string;
  superficieHa: number;
  poligono: Poligono;
  estado: EstadoPotrero;
  cargaRecomendadaEvHa: number;
}

export interface Rodeo {
  id: string;
  nombre: string;
  // Nullable — patrón "alerta, no bloqueo" igual que RegistroScouting.especieId:
  // sin categoría confirmada el rodeo igual se guarda, con categoriaSugerida +
  // pendienteRevision en vez de bloquear el alta.
  categoriaId: string | null;
  categoriaSugerida: string | null;
  pendienteRevision: boolean;
  // Derivado por trigger a partir de movimientos_stock — nunca se calcula acá.
  cantidadCabezas: number;
  potreroId: string | null;
  sync: EstadoSync;
  version?: number;
}

export interface MovimientoStock {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  fecha: string;
  motivo: string | null;
}

export interface RotacionPotrero {
  id: string;
  potreroOrigenId: string | null;
  potreroDestinoId: string;
  fecha: string;
}

export interface EventoSanitario {
  id: string;
  rodeoId: string;
  tipo: "vacunacion" | "desparasitacion" | "diagnostico" | "tratamiento";
  producto: string;
  fecha: string;
  proximoRefuerzo: string | null;
}

export type TipoMaquina = "pulverizadora" | "sembradora" | "fertilizadora" | "cosechadora" | "tractor" | "otro";

export interface Maquina {
  id: string;
  nombre: string;
  tipo: TipoMaquina;
  marca: string | null;
  modelo: string | null;
  /** Espaciamiento entre boquillas/surcos (m) — en el backend es "anchoLaborM", ver catalogos-store. */
  espaciamientoM: number | null;
}

export interface Calibracion {
  id: string;
  maquinaId: string;
  tipoCalculo: "dosis_objetivo" | "verificacion_aforo" | "verificacion_siembra";
  resumen: string;
  resultado: string;
  desvioPct: number | null;
  alerta: boolean;
  fecha: string;
}

/* --------------------------------- fórmulas -------------------------------- */

/** Q = (Dosis[L/ha] × Velocidad[km/h] × Espaciamiento[m]) / 600 */
export function caudalPorBoquilla(dosisLHa: number, velocidadKmH: number, espaciamientoM: number) {
  return (dosisLHa * velocidadKmH * espaciamientoM) / 600;
}

/** D = 600Q / (V × A) */
export function dosisReal(caudalLMin: number, velocidadKmH: number, espaciamientoM: number) {
  return (600 * caudalLMin) / (velocidadKmH * espaciamientoM);
}

/** Q2 = Q1 × √(P2/P1) */
export function ajustePorPresion(q1: number, p1: number, p2: number) {
  return q1 * Math.sqrt(p2 / p1);
}

/** Desvío % = (medido − teórico) / teórico × 100 */
export function desvioPct(medido: number, teorico: number) {
  if (!teorico) return 0;
  return ((medido - teorico) / teorico) * 100;
}

/** S = Tanque / Dosis */
export function superficiePorTanque(tanqueL: number, dosisLHa: number) {
  return dosisLHa ? tanqueL / dosisLHa : 0;
}

/** d = 1.000.000 / (Densidad[sem/ha] × Espaciamiento[m]) — en cm */
export function distanciaEntreSemillas(densidadSemHa: number, espaciamientoM: number) {
  if (!densidadSemHa || !espaciamientoM) return 0;
  return 1_000_000 / (densidadSemHa * espaciamientoM);
}

/** N = Dist[cm] / d[cm] */
export function semillasEsperadas(distanciaMetros: number, dCm: number) {
  if (!dCm) return 0;
  return (distanciaMetros * 100) / dCm;
}

/** cantidadCabezas lo deriva un trigger a partir de movimientos_stock — nunca se suma acá. */
export function cabezasDeRodeo(rodeo: Rodeo) {
  return rodeo.cantidadCabezas;
}

/** categoriasGanado se recibe como parámetro (real, de useCatalogos()) — nunca se cierra sobre un catálogo estático. */
export function evDeRodeo(rodeo: Rodeo, categoriasGanado: CategoriaGanado[]) {
  const cat = rodeo.categoriaId ? categoriasGanado.find((c) => c.id === rodeo.categoriaId) : undefined;
  return cabezasDeRodeo(rodeo) * (cat?.ev ?? 0);
}

/** Carga = Σ (cabezas × EV) / superficie[ha] */
export function cargaDePotrero(potrero: Potrero, listaRodeos: Rodeo[], categoriasGanado: CategoriaGanado[]) {
  const ev = listaRodeos
    .filter((r) => r.potreroId === potrero.id)
    .reduce((acc, r) => acc + evDeRodeo(r, categoriasGanado), 0);
  return potrero.superficieHa ? ev / potrero.superficieHa : 0;
}

/* --------------------------------- helpers -------------------------------- */

export const nf = (n: number, dec = 1) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);

export const nfInt = (n: number) => new Intl.NumberFormat("es-AR").format(Math.round(n));

export const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(iso));

export const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const etiquetaLabor: Record<TipoLabor, string> = {
  siembra: "Siembra",
  pulverizacion: "Pulverización",
  fertilizacion: "Fertilización",
  cosecha: "Cosecha",
};

export const etiquetaEstado: Record<EstadoOrden, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  requiere_revision: "Requiere revisión",
};

export const etiquetaMovimiento: Record<TipoMovimiento, string> = {
  nacimiento: "Nacimiento",
  compra: "Compra",
  venta: "Venta",
  muerte: "Muerte",
  traslado_entrada: "Traslado (entrada)",
  traslado_salida: "Traslado (salida)",
  ajuste_conteo: "Ajuste de conteo",
};

export const etiquetaMetodo: Record<MetodoCuantificacion, string> = {
  conteo_area: "Conteo por área",
  cobertura: "Cobertura",
  incidencia_severidad: "Incidencia · severidad",
};
