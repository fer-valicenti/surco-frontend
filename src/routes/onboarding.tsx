import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Check, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapaEditorPoligono } from "@/components/surco/mapa-editor";
import { InstallApp } from "@/components/surco/install-app";
import { useAuth } from "@/lib/auth-store";
import { api, ApiError } from "@/lib/api-client";
import { aGeoJson } from "@/lib/geo";
import { nf, type Poligono } from "@/lib/surco-data";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Crear establecimiento — Surco" }],
  }),
  component: OnboardingPage,
});

// Centro por defecto del mapa para un establecimiento sin lotes todavía —
// zona agrícola de Nueve de Julio, Buenos Aires (el mismo punto de referencia
// que usan los datos de ejemplo del resto de la app).
const CENTRO_MAPA_DEFAULT: [number, number] = [-35.445, -60.885];

interface EstablecimientoApi {
  id: string;
  nombre: string;
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { registrar, recargarEstablecimiento } = useAuth();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [enviando, setEnviando] = useState(false);

  const [tuNombre, setTuNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [cuit, setCuit] = useState("");
  const [provincia, setProvincia] = useState("");
  const [partido, setPartido] = useState("");

  const [nombreLote, setNombreLote] = useState("Lote 1");
  const [poligono, setPoligono] = useState<Poligono | null>(null);
  const [superficie, setSuperficie] = useState(0);
  const [superpuestos, setSuperpuestos] = useState<{ id: string; nombre: string; puntos: Poligono }[]>([]);

  const poligonoValido = poligono !== null && poligono.length >= 3 && superpuestos.length === 0;

  const validarDatos = () => {
    if (!tuNombre.trim() || !email.trim() || !password.trim() || !nombre.trim()) {
      toast.error("Completá tu nombre, email, contraseña y el nombre del establecimiento");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña tiene que tener al menos 8 caracteres");
      return;
    }
    setPaso(2);
  };

  const confirmarPoligono = () => {
    if (!poligonoValido) return;
    setPaso(3);
  };

  const finalizar = async () => {
    if (!poligono) return;
    setEnviando(true);
    try {
      const resultado = await registrar(tuNombre.trim(), email.trim(), password, true);
      if (!resultado.ok) {
        toast.error(resultado.error);
        setEnviando(false);
        return;
      }
      const est = await api.post<EstablecimientoApi>("/establecimientos", {
        nombre: nombre.trim(),
        cuit: cuit.trim() || undefined,
        provincia: provincia.trim() || undefined,
        partido: partido.trim() || undefined,
      });
      await api.post("/lotes", {
        establecimientoId: est.id,
        nombre: nombreLote.trim() || "Lote 1",
        poligono: aGeoJson(poligono),
      });
      await recargarEstablecimiento();
      toast.success("Establecimiento creado", {
        description: `${nombre} — ${nombreLote} (${nf(superficie)} ha)`,
      });
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo crear el establecimiento");
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-lg px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          {paso > 1 ? (
            <button
              onClick={() => setPaso((p) => (p === 3 ? 2 : 1))}
              aria-label="Volver"
              className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-card text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="flex-1">
            <p className="label-field">Paso {paso} de 3</p>
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= paso ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
          </div>
        </div>

        {paso === 1 ? (
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Creá tu cuenta y tu establecimiento</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Datos básicos — los podés editar después.</p>
            </div>
            <div className="space-y-4 rounded-md border border-border bg-card p-4">
              <p className="label-field">Tu cuenta</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ob-tunombre">Tu nombre</Label>
                  <Input id="ob-tunombre" value={tuNombre} onChange={(e) => setTuNombre(e.target.value)} placeholder="Nombre y apellido" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-email">Email</Label>
                  <Input id="ob-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@ejemplo.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob-password">Contraseña</Label>
                <Input id="ob-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
              </div>
            </div>
            <div className="space-y-4 rounded-md border border-border bg-card p-4">
              <p className="label-field">Establecimiento</p>
              <div className="space-y-2">
                <Label htmlFor="ob-nombre">Nombre</Label>
                <Input id="ob-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del establecimiento" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob-cuit">CUIT (opcional)</Label>
                <Input id="ob-cuit" value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="30-71442589-3" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ob-prov">Provincia</Label>
                  <Input id="ob-prov" value={provincia} onChange={(e) => setProvincia(e.target.value)} placeholder="Buenos Aires" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-partido">Partido</Label>
                  <Input id="ob-partido" value={partido} onChange={(e) => setPartido(e.target.value)} placeholder="Nueve de Julio" />
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={validarDatos}>
              Continuar
            </Button>
            <InstallApp />
          </div>
        ) : null}

        {paso === 2 ? (
          <div className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Dibujá el primer lote</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Mapa real de OpenStreetMap — tocá para marcar cada vértice. La superficie se calcula del polígono, no se tipea.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ob-lote-nombre">Nombre del lote</Label>
              <Input id="ob-lote-nombre" value={nombreLote} onChange={(e) => setNombreLote(e.target.value)} />
            </div>

            <MapaEditorPoligono
              centro={CENTRO_MAPA_DEFAULT}
              poligonosExistentes={[]}
              onCambio={(puntos, ha, sup) => {
                setPoligono(puntos);
                setSuperficie(ha);
                setSuperpuestos(sup);
              }}
            />

            {poligono ? (
              <div className="rounded-md border border-border bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <p className="label-field">Superficie calculada</p>
                  <p className="num text-2xl font-semibold text-foreground">
                    {nf(superficie)} <span className="text-sm text-muted-foreground">ha</span>
                  </p>
                </div>
                {!poligonoValido ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Se superpone con {superpuestos.map((l) => l.nombre).join(", ")}.
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ok">
                    <Check className="h-3.5 w-3.5" /> Polígono válido.
                  </p>
                )}
              </div>
            ) : null}

            <Button className="w-full" onClick={confirmarPoligono} disabled={!poligonoValido}>
              Continuar
            </Button>
          </div>
        ) : null}

        {paso === 3 ? (
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Todo listo</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Revisá y confirmá el alta.</p>
            </div>
            <div className="divide-y divide-border rounded-md border border-border bg-card">
              <div className="p-4">
                <p className="label-field">Tu cuenta</p>
                <p className="mt-1 font-semibold text-foreground">{tuNombre}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
              <div className="p-4">
                <p className="label-field">Establecimiento</p>
                <p className="mt-1 font-semibold text-foreground">{nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {[partido, provincia].filter(Boolean).join(", ") || "Sin ubicación declarada"}
                </p>
              </div>
              <div className="p-4">
                <p className="label-field">Primer lote</p>
                <p className="mt-1 font-semibold text-foreground">{nombreLote}</p>
                <p className="num text-xs text-muted-foreground">{nf(superficie)} ha</p>
              </div>
            </div>
            <Button className="flex w-full items-center justify-center gap-2" onClick={finalizar} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Crear establecimiento
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
