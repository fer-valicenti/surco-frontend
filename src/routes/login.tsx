import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { autenticado, cargando: restaurandoSesion, login } = useAuth();

  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (autenticado) navigate({ to: "/", replace: true });
  }, [autenticado, navigate]);

  const ingresar = async () => {
    if (!email.trim() || !contrasena.trim()) {
      toast.error("Completá email y contraseña");
      return;
    }
    setEnviando(true);
    const resultado = await login(email.trim(), contrasena, recordar);
    setEnviando(false);
    if (resultado.ok) {
      toast.success("Sesión iniciada");
      navigate({ to: "/" });
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-col items-center bg-gradient-to-br from-surface-ink to-[#1F3D34] px-6 pb-12 pt-14 text-center text-surface-ink-foreground sm:pt-20">
        <div className="mb-3.5 grid h-[58px] w-[58px] place-items-center rounded-2xl border border-primary/35 bg-primary/15 text-primary">
          <svg width="30" height="20" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 3c2-2 4-2 6 0s4 2 6 0s4-2 6 0" />
            <path d="M2 8c2-2 4-2 6 0s4 2 6 0s4-2 6 0" />
            <path d="M2 13c2-2 4-2 6 0s4 2 6 0s4-2 6 0" />
          </svg>
        </div>
        <p className="font-display text-[26px] font-bold tracking-tight">surco</p>
        <p className="mt-1.5 text-xs text-surface-ink-foreground/65">Gestión de campo, con o sin señal</p>
      </div>

      <div className="-mt-6 flex-1 rounded-t-[26px] bg-card px-6 pb-8 pt-7 shadow-[0_-8px_24px_rgba(22,48,42,0.06)] sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="mb-4">
          <span className="label-field mb-2 block">Email</span>
          <div className="flex items-center gap-2.5 rounded-[10px] border-[1.4px] border-border bg-muted/40 px-3 py-2.5 focus-within:border-primary focus-within:bg-card">
            <Mail className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="fernando@lablanqueada.com.ar"
              autoComplete="username"
              className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => e.key === "Enter" && ingresar()}
            />
          </div>
        </div>

        <div className="mb-1">
          <span className="label-field mb-2 block">Contraseña</span>
          <div className="flex items-center gap-2.5 rounded-[10px] border-[1.4px] border-border bg-muted/40 px-3 py-2.5 focus-within:border-primary focus-within:bg-card">
            <Lock className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
            <input
              type={verContrasena ? "text" : "password"}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => e.key === "Enter" && ingresar()}
            />
            <button
              type="button"
              aria-label={verContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setVerContrasena((v) => !v)}
              className="shrink-0 text-muted-foreground"
            >
              {verContrasena ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="my-3.5 flex items-center justify-between">
          <label className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <Checkbox checked={recordar} onCheckedChange={(v) => setRecordar(v === true)} />
            Recordarme
          </label>
          <button
            type="button"
            onClick={() =>
              toast("Recuperación de contraseña", {
                description: "Pedile a un administrador del establecimiento que te reenvíe una invitación.",
              })
            }
            className="text-[11.5px] font-semibold text-primary"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <button
          onClick={ingresar}
          disabled={enviando || restaurandoSesion}
          className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-primary py-3.5 text-[13.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Ingresar
        </button>

        <div className="mt-8 flex items-start gap-1.5 text-[10.5px] leading-[1.4] text-muted-foreground">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
          Iniciá sesión una vez — después funciona sin conexión.
        </div>

        <p className="mt-4 text-center text-[11.5px] text-muted-foreground">
          ¿Primera vez?{" "}
          <button
            type="button"
            onClick={() => navigate({ to: "/onboarding" })}
            className="font-semibold text-primary"
          >
            Creá tu cuenta y tu establecimiento
          </button>
        </p>
      </div>
    </div>
  );
}
