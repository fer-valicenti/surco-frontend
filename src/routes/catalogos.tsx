import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Beef, Droplets, Leaf, MapPinned, Plus, Tractor } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { Chip, PageHeader, SectionLabel } from "@/components/surco/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapaEditorPoligono } from "@/components/surco/mapa-editor";
import { MapaMiniPoligono } from "@/components/surco/mapa-mini";
import { useCatalogos } from "@/lib/catalogos-store";
import { centroide } from "@/lib/geo";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { nf, puedeGestionar } from "@/lib/surco-data";
import type { EstadoPotrero, MetodoCuantificacion, Poligono, TipoHallazgo, TipoMaquina, TipoInsumo } from "@/lib/surco-data";

const ETIQUETA_TIPO_MAQUINA: Record<TipoMaquina, string> = {
  pulverizadora: "Pulverizadora",
  sembradora: "Sembradora",
  fertilizadora: "Fertilizadora",
  cosechadora: "Cosechadora",
  tractor: "Tractor",
  otro: "Otro",
};
const ETIQUETA_TIPO_INSUMO: Record<TipoInsumo, string> = {
  fitosanitario: "Fitosanitario",
  fertilizante: "Fertilizante",
  semilla: "Semilla",
  otro: "Otro",
};

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

export const Route = createFileRoute("/catalogos")({
  head: () => ({
    meta: [
      { title: "Catálogos — Surco" },
      { name: "description", content: "Especies, máquinas, insumos, potreros y categorías de ganado del establecimiento." },
    ],
  }),
  component: CatalogosPage,
});

const ETIQUETA_TIPO_HALLAZGO: Record<TipoHallazgo, string> = { plaga: "Plaga", maleza: "Maleza", enfermedad: "Enfermedad" };
const ETIQUETA_METODO: Record<MetodoCuantificacion, string> = {
  conteo_area: "Conteo por área",
  cobertura: "Cobertura",
  incidencia_severidad: "Incidencia / severidad",
};
const ETIQUETA_ESTADO_POTRERO: Record<EstadoPotrero, string> = {
  disponible: "Disponible",
  en_pastoreo: "En pastoreo",
  en_descanso: "En descanso",
};

function CatalogosPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Catálogos · §07"
        title="Catálogos del establecimiento"
        description="Especies, máquinas, insumos, potreros y categorías de ganado — usados en scouting, calibración, órdenes y ganadería."
      />

      <Tabs defaultValue="especies">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="especies"><Leaf className="h-4 w-4" /> Especies</TabsTrigger>
          <TabsTrigger value="maquinas"><Tractor className="h-4 w-4" /> Máquinas</TabsTrigger>
          <TabsTrigger value="insumos"><Droplets className="h-4 w-4" /> Insumos</TabsTrigger>
          <TabsTrigger value="potreros"><MapPinned className="h-4 w-4" /> Potreros</TabsTrigger>
          <TabsTrigger value="categorias"><Beef className="h-4 w-4" /> Categorías de ganado</TabsTrigger>
        </TabsList>

        <TabsContent value="especies" className="mt-4"><TabEspecies /></TabsContent>
        <TabsContent value="maquinas" className="mt-4"><TabMaquinas /></TabsContent>
        <TabsContent value="insumos" className="mt-4"><TabInsumos /></TabsContent>
        <TabsContent value="potreros" className="mt-4"><TabPotreros /></TabsContent>
        <TabsContent value="categorias" className="mt-4"><TabCategorias /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* --------------------------------- especies -------------------------------- */

function TabEspecies() {
  const { establecimiento } = useAuth();
  const { especies, agregarEspecie } = useCatalogos();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoHallazgo>("plaga");
  const [nombreComun, setNombreComun] = useState("");
  const [nombreCientifico, setNombreCientifico] = useState("");
  const [metodo, setMetodo] = useState<MetodoCuantificacion>("conteo_area");
  const [umbral, setUmbral] = useState("");
  const [unidad, setUnidad] = useState("");

  const crear = async () => {
    if (!nombreComun.trim() || !nombreCientifico.trim() || !unidad.trim()) {
      toast.error("Completá nombre común, científico y unidad de medida");
      return;
    }
    try {
      await agregarEspecie({
        tipo,
        nombreComun: nombreComun.trim(),
        nombreCientifico: nombreCientifico.trim(),
        metodo,
        umbralAccion: umbral.trim() ? Number(umbral) : null,
        unidadMedida: unidad.trim(),
      });
      setAbierto(false);
      setNombreComun("");
      setNombreCientifico("");
      setUmbral("");
      setUnidad("");
      toast.success("Especie agregada al catálogo");
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo guardar la especie"));
    }
  };

  return (
    <section className="space-y-3">
      <SectionLabel
        aside={
          puedeGestionar(establecimiento?.rol) ? (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Nueva especie</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva especie</DialogTitle>
                <DialogDescription>Queda disponible al instante en el selector de scouting.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as TipoHallazgo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ETIQUETA_TIPO_HALLAZGO) as TipoHallazgo[]).map((t) => (
                        <SelectItem key={t} value={t}>{ETIQUETA_TIPO_HALLAZGO[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="esp-comun">Nombre común</Label>
                    <Input id="esp-comun" value={nombreComun} onChange={(e) => setNombreComun(e.target.value)} placeholder="Barrenador del tallo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="esp-cient">Nombre científico</Label>
                    <Input id="esp-cient" value={nombreCientifico} onChange={(e) => setNombreCientifico(e.target.value)} placeholder="Diatraea saccharalis" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Método de cuantificación</Label>
                  <Select value={metodo} onValueChange={(v) => setMetodo(v as MetodoCuantificacion)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ETIQUETA_METODO) as MetodoCuantificacion[]).map((m) => (
                        <SelectItem key={m} value={m}>{ETIQUETA_METODO[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="esp-umbral">Umbral de acción (opcional)</Label>
                    <Input id="esp-umbral" inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value)} placeholder="5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="esp-unidad">Unidad de medida</Label>
                    <Input id="esp-unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="ind./planta" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={crear}>Guardar especie</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : null
        }
      >
        {especies.length} especies
      </SectionLabel>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border">
            <tr className="text-left">
              <th className="label-field p-3">Especie</th>
              <th className="label-field p-3">Tipo</th>
              <th className="label-field p-3">Cuantificación</th>
              <th className="label-field p-3 text-right">Umbral</th>
            </tr>
          </thead>
          <tbody>
            {especies.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="p-3">
                  <span className="block font-semibold">{e.nombreComun}</span>
                  <span className="block text-xs italic text-muted-foreground">{e.nombreCientifico}</span>
                </td>
                <td className="p-3"><Chip tone="neutral">{ETIQUETA_TIPO_HALLAZGO[e.tipo]}</Chip></td>
                <td className="p-3 text-muted-foreground">{ETIQUETA_METODO[e.metodo]}</td>
                <td className="num p-3 text-right">{e.umbralAccion !== null ? `${nf(e.umbralAccion)} ${e.unidadMedida}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --------------------------------- máquinas -------------------------------- */

function TabMaquinas() {
  const { establecimiento } = useAuth();
  const { maquinas, agregarMaquina } = useCatalogos();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [tipo, setTipo] = useState<TipoMaquina>("pulverizadora");
  const [espaciamiento, setEspaciamiento] = useState("");

  const crear = async () => {
    if (!nombre.trim()) {
      toast.error("Completá el nombre de la máquina");
      return;
    }
    try {
      await agregarMaquina({
        nombre: nombre.trim(),
        tipo,
        marca: marca.trim() || undefined,
        modelo: modelo.trim() || undefined,
        espaciamientoM: espaciamiento.trim() ? Number(espaciamiento) : null,
      });
      setAbierto(false);
      setNombre("");
      setMarca("");
      setModelo("");
      setEspaciamiento("");
      toast.success("Máquina agregada al catálogo");
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo guardar la máquina"));
    }
  };

  return (
    <section className="space-y-3">
      <SectionLabel
        aside={
          puedeGestionar(establecimiento?.rol) ? (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Nueva máquina</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva máquina</DialogTitle>
                <DialogDescription>Queda disponible al instante en Calibración.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maq-nombre">Nombre</Label>
                  <Input id="maq-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Pulverizadora Metalfor 4000" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMaquina)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ETIQUETA_TIPO_MAQUINA) as TipoMaquina[]).map((t) => (
                        <SelectItem key={t} value={t}>{ETIQUETA_TIPO_MAQUINA[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maq-marca">Marca (opcional)</Label>
                    <Input id="maq-marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Metalfor" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maq-modelo">Modelo (opcional)</Label>
                    <Input id="maq-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="4000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maq-esp">Espaciamiento entre boquillas/surcos (m, opcional)</Label>
                  <Input id="maq-esp" inputMode="decimal" value={espaciamiento} onChange={(e) => setEspaciamiento(e.target.value)} placeholder="0,52" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={crear}>Guardar máquina</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : null
        }
      >
        {maquinas.length} máquinas
      </SectionLabel>
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {maquinas.map((m) => (
          <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{m.nombre}</p>
              <p className="num mt-0.5 text-xs text-muted-foreground">
                {[m.marca, m.modelo].filter(Boolean).join(" ") || "Sin marca/modelo"}
                {m.espaciamientoM !== null ? ` · ${nf(m.espaciamientoM, 2)} m` : ""}
              </p>
            </div>
            <Chip tone={m.tipo === "pulverizadora" || m.tipo === "sembradora" ? "field" : "neutral"}>
              {ETIQUETA_TIPO_MAQUINA[m.tipo]}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------- insumos --------------------------------- */

function TabInsumos() {
  const { establecimiento } = useAuth();
  const { insumos, agregarInsumo } = useCatalogos();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoInsumo>("fitosanitario");
  const [unidad, setUnidad] = useState("");

  const crear = async () => {
    if (!nombre.trim() || !unidad.trim()) {
      toast.error("Completá nombre y unidad");
      return;
    }
    try {
      await agregarInsumo({ nombre: nombre.trim(), tipo, unidad: unidad.trim() });
      setAbierto(false);
      setNombre("");
      setUnidad("");
      toast.success("Insumo agregado al catálogo");
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo guardar el insumo"));
    }
  };

  return (
    <section className="space-y-3">
      <SectionLabel
        aside={
          puedeGestionar(establecimiento?.rol) ? (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Nuevo insumo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo insumo</DialogTitle>
                <DialogDescription>Queda disponible al instante al armar una orden de trabajo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ins-nombre">Nombre</Label>
                  <Input id="ins-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="2,4-D Amina" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInsumo)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ETIQUETA_TIPO_INSUMO) as TipoInsumo[]).map((t) => (
                          <SelectItem key={t} value={t}>{ETIQUETA_TIPO_INSUMO[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ins-unidad">Unidad</Label>
                    <Input id="ins-unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="l" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={crear}>Guardar insumo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : null
        }
      >
        {insumos.length} insumos
      </SectionLabel>
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {insumos.map((i) => (
          <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4">
            <p className="truncate font-semibold">{i.nombre}</p>
            <Chip tone="neutral">{ETIQUETA_TIPO_INSUMO[i.tipo]}</Chip>
            <span className="num text-xs text-muted-foreground">{i.unidad}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------- potreros --------------------------------- */

function TabPotreros() {
  const { establecimiento } = useAuth();
  const { potreros, agregarPotrero } = useCatalogos();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState<EstadoPotrero>("disponible");
  const [carga, setCarga] = useState("");
  const [poligono, setPoligono] = useState<Poligono | null>(null);
  const [superficie, setSuperficie] = useState(0);
  const [superpuestos, setSuperpuestos] = useState<{ id: string; nombre: string; puntos: Poligono }[]>([]);

  const centroMapa = centroide(potreros.flatMap((p) => p.poligono));

  const crear = async () => {
    if (!nombre.trim() || !Number(carga) || !poligono || poligono.length < 3) {
      toast.error("Completá nombre, carga recomendada y el polígono");
      return;
    }
    if (superpuestos.length > 0) {
      toast.error("El polígono se superpone", { description: superpuestos.map((s) => s.nombre).join(", ") });
      return;
    }
    try {
      await agregarPotrero({
        nombre: nombre.trim(),
        superficieHa: superficie,
        poligono,
        estado,
        cargaRecomendadaEvHa: Number(carga),
      });
      setAbierto(false);
      setNombre("");
      setCarga("");
      setPoligono(null);
      setSuperficie(0);
      toast.success("Potrero agregado al catálogo");
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo guardar el potrero"));
    }
  };

  return (
    <section className="space-y-3">
      <SectionLabel
        aside={
          puedeGestionar(establecimiento?.rol) ? (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Nuevo potrero</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Nuevo potrero</DialogTitle>
                <DialogDescription>Queda disponible al instante para mover rodeos en Ganadería.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pot-nombre">Nombre</Label>
                    <Input id="pot-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Potrero Las Acacias" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pot-carga">Carga recomendada (EV/ha)</Label>
                    <Input id="pot-carga" inputMode="decimal" value={carga} onChange={(e) => setCarga(e.target.value)} placeholder="1,10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={estado} onValueChange={(v) => setEstado(v as EstadoPotrero)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ETIQUETA_ESTADO_POTRERO) as EstadoPotrero[]).map((e) => (
                        <SelectItem key={e} value={e}>{ETIQUETA_ESTADO_POTRERO[e]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Polígono</Label>
                  <MapaEditorPoligono
                    centro={centroMapa}
                    poligonosExistentes={potreros.map((p) => ({ id: p.id, nombre: p.nombre, puntos: p.poligono }))}
                    onCambio={(puntos, ha, sup) => {
                      setPoligono(puntos);
                      setSuperficie(ha);
                      setSuperpuestos(sup);
                    }}
                  />
                  {poligono ? (
                    <p className="num text-sm text-foreground">
                      {nf(superficie)} ha calculadas
                      {superpuestos.length > 0 ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> se superpone con {superpuestos.map((s) => s.nombre).join(", ")}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={crear}>Guardar potrero</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : null
        }
      >
        {potreros.length} potreros
      </SectionLabel>
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {potreros.map((p) => (
          <li key={p.id} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 p-4">
            <MapaMiniPoligono puntos={p.poligono} claseAltura="h-16" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.nombre}</p>
              <p className="num mt-0.5 text-xs text-muted-foreground">
                {nf(p.superficieHa)} ha · recomendada {nf(p.cargaRecomendadaEvHa, 2)} EV/ha
              </p>
            </div>
            <Chip tone="neutral">{ETIQUETA_ESTADO_POTRERO[p.estado]}</Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------- categorías de ganado --------------------------- */

function TabCategorias() {
  const { establecimiento } = useAuth();
  const { categoriasGanado, agregarCategoriaGanado } = useCatalogos();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [ev, setEv] = useState("");

  const crear = async () => {
    if (!nombre.trim() || !Number(ev)) {
      toast.error("Completá nombre y equivalencia EV");
      return;
    }
    try {
      await agregarCategoriaGanado({ nombre: nombre.trim(), ev: Number(ev) });
      setAbierto(false);
      setNombre("");
      setEv("");
      toast.success("Categoría agregada al catálogo");
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo guardar la categoría"));
    }
  };

  return (
    <section className="space-y-3">
      <SectionLabel
        aside={
          puedeGestionar(establecimiento?.rol) ? (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Nueva categoría</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva categoría de ganado</DialogTitle>
                <DialogDescription>El equivalente vaca (EV) se usa para calcular carga animal por potrero.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cat-nombre">Nombre</Label>
                  <Input id="cat-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Vaquillona" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-ev">Equivalente vaca (EV)</Label>
                  <Input id="cat-ev" inputMode="decimal" value={ev} onChange={(e) => setEv(e.target.value)} placeholder="0,7" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={crear}>Guardar categoría</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : null
        }
      >
        {categoriasGanado.length} categorías
      </SectionLabel>
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {categoriasGanado.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 p-4">
            <p className="font-semibold">{c.nombre}</p>
            <span className="num rounded-md bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">×{nf(c.ev, 2)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
