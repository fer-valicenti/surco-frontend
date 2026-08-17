import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/restablecer-password")({
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: RestablecerPasswordPage,
});

function RestablecerPasswordPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const { restablecerPassword } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!token) {
      toast.error("El link no es válido — pedí uno nuevo");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirmar) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setEnviando(true);
    const resultado = await restablecerPassword(token, password);
    setEnviando(false);
    if (resultado.ok) {
      toast.success("Contraseña actualizada");
      navigate({ to: "/login" });
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
        <p className="mt-1.5 text-xs text-surface-ink-foreground/65">Elegí una contraseña nueva</p>
      </div>

      <div className="-mt-6 flex-1 rounded-t-[26px] bg-card px-6 pb-8 pt-7 shadow-[0_-8px_24px_rgba(22,48,42,0.06)] sm:mx-auto sm:w-full sm:max-w-sm">
        {!token ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-[13.5px] font-semibold text-foreground">Este link no es válido</p>
            <p className="mt-1.5 text-[12px] leading-[1.5] text-muted-foreground">
              Puede haber vencido o ya haberse usado. Pedí uno nuevo.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/recuperar-password" })}
              className="mt-4 text-[11.5px] font-semibold text-primary"
            >
              Pedir un link nuevo
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <span className="label-field mb-2 block">Contraseña nueva</span>
              <div className="flex items-center gap-2.5 rounded-[10px] border-[1.4px] border-border bg-muted/40 px-3 py-2.5 focus-within:border-primary focus-within:bg-card">
                <Lock className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
                <input
                  type={verPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setVerPassword((v) => !v)}
                  className="shrink-0 text-muted-foreground"
                >
                  {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <span className="label-field mb-2 block">Confirmar contraseña</span>
              <div className="flex items-center gap-2.5 rounded-[10px] border-[1.4px] border-border bg-muted/40 px-3 py-2.5 focus-within:border-primary focus-within:bg-card">
                <Lock className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
                <input
                  type={verPassword ? "text" : "password"}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
                  onKeyDown={(e) => e.key === "Enter" && enviar()}
                />
              </div>
            </div>

            <button
              onClick={enviar}
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-primary py-3.5 text-[13.5px] font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar contraseña
            </button>
          </>
        )}
      </div>
    </div>
  );
}
