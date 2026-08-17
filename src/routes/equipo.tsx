import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Send, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/surco/shell";
import { Chip, EmptyHint, PageHeader, SectionLabel, Stat } from "@/components/surco/bits";
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
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import { useEquipo, type EstadoInvitacion } from "@/lib/equipo-store";
import { fechaHora, puedeGestionar, type Rol } from "@/lib/surco-data";

export const Route = createFileRoute("/equipo")({
  head: () => ({
    meta: [
      { title: "Equipo — Surco" },
      { name: "description", content: "Miembros del establecimiento, roles e invitaciones pendientes." },
    ],
  }),
  component: EquipoPage,
});

const ETIQUETA_ROL: Record<Rol, string> = {
  propietario: "Propietario",
  agronomo: "Agrónomo",
  operario: "Operario",
};

const ETIQUETA_ESTADO_INVITACION: Record<EstadoInvitacion, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  revocada: "Revocada",
  expirada: "Expirada",
};

function mensajeError(e: unknown, fallback: string) {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback;
}

function EquipoPage() {
  const { establecimiento } = useAuth();
  const gestiona = puedeGestionar(establecimiento?.rol);
  const { miembros, invitaciones, invitar, revocar, removerMiembro } = useEquipo();
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("operario");
  const [enviando, setEnviando] = useState(false);

  const pendientes = invitaciones.filter((i) => i.estado === "pendiente");

  const enviarInvitacion = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Ingresá un email válido");
      return;
    }
    if (miembros.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
      toast.error("Ya es miembro del establecimiento");
      return;
    }
    setEnviando(true);
    try {
      await invitar(email.trim(), rol);
      setAbierto(false);
      setEmail("");
      setRol("operario");
      toast.success("Invitación enviada", { description: `${email} — ${ETIQUETA_ROL[rol]}` });
    } catch (e) {
      toast.error("No se pudo enviar la invitación", { description: mensajeError(e, "Intentá de nuevo.") });
    } finally {
      setEnviando(false);
    }
  };

  const quitar = async (id: string, nombre: string) => {
    try {
      await removerMiembro(id);
      toast.success("Miembro removido", { description: `${nombre} ya no tiene acceso al establecimiento.` });
    } catch (e) {
      toast.error("No se pudo remover al miembro", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  const revocarInvitacion = async (id: string, email2: string) => {
    try {
      await revocar(id);
      toast.success("Invitación revocada", { description: email2 });
    } catch (e) {
      toast.error("No se pudo revocar la invitación", { description: mensajeError(e, "Intentá de nuevo.") });
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Equipo · §03"
        title="Equipo del establecimiento"
        description="Quién tiene acceso y con qué rol — propietario y agrónomo gestionan catálogos y estructura; operario solo captura en el campo."
        actions={
          gestiona ? (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4" /> Invitar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invitar al establecimiento</DialogTitle>
                <DialogDescription>Se manda un email con un link de invitación válido por 7 días.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-inv">Email</Label>
                  <Input
                    id="email-inv"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agronomo">Agrónomo</SelectItem>
                      <SelectItem value="operario">Operario</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={enviando} onClick={enviarInvitacion}>
                  <Send className="h-4 w-4" /> {enviando ? "Enviando…" : "Enviar invitación"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Miembros" value={String(miembros.length)} hint={`${miembros.filter((m) => m.rol === "propietario").length} propietario(s)`} />
        <Stat label="Invitaciones pendientes" value={String(pendientes.length)} tone={pendientes.length ? "warn" : "default"} />
      </section>

      <section className="space-y-3">
        <SectionLabel aside={<span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{miembros.length}</span>}>
          Miembros
        </SectionLabel>
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {miembros.map((m) => (
            <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{m.nombre}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" /> {m.email}
                </p>
              </div>
              <Chip tone={m.rol === "propietario" ? "ink" : "neutral"}>{ETIQUETA_ROL[m.rol]}</Chip>
              <Button
                size="sm"
                variant="outline"
                disabled={m.rol === "propietario" || !gestiona}
                onClick={() => quitar(m.id, m.nombre)}
                aria-label={`Quitar a ${m.nombre}`}
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionLabel aside={`${invitaciones.length} en total`}>Invitaciones</SectionLabel>
        {invitaciones.length === 0 ? (
          <EmptyHint>Sin invitaciones enviadas.</EmptyHint>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {invitaciones.map((i) => (
              <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{i.email}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {ETIQUETA_ROL[i.rol]} · invitado por {i.invitadoPor} · {fechaHora(i.fecha)}
                  </p>
                </div>
                <Chip
                  tone={i.estado === "pendiente" ? "warn" : i.estado === "aceptada" ? "ok" : "neutral"}
                >
                  {ETIQUETA_ESTADO_INVITACION[i.estado]}
                </Chip>
                {i.estado === "pendiente" && gestiona ? (
                  <Button size="sm" variant="outline" onClick={() => revocarInvitacion(i.id, i.email)}>
                    Revocar
                  </Button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
