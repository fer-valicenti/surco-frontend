import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/verificar-email")({
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: VerificarEmailPage,
});

type Estado = "cargando" | "exito" | "error";

function VerificarEmailPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const { verificarEmail, autenticado } = useAuth();

  const [estado, setEstado] = useState<Estado>(token ? "cargando" : "error");
  const yaIntentado = useRef(false);

  useEffect(() => {
    if (!token || yaIntentado.current) return;
    yaIntentado.current = true;
    verificarEmail(token).then((resultado) => setEstado(resultado.ok ? "exito" : "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
        <p className="mt-1.5 text-xs text-surface-ink-foreground/65">Verificación de email</p>
      </div>

      <div className="-mt-6 flex-1 rounded-t-[26px] bg-card px-6 pb-8 pt-7 shadow-[0_-8px_24px_rgba(22,48,42,0.06)] sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="flex flex-col items-center py-6 text-center">
          {estado === "cargando" ? (
            <>
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
              <p className="text-[13.5px] font-semibold text-foreground">Confirmando tu email…</p>
            </>
          ) : estado === "exito" ? (
            <>
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-ok/15 text-ok">
                <Check className="h-5 w-5" />
              </div>
              <p className="text-[13.5px] font-semibold text-foreground">¡Email verificado!</p>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-muted-foreground">
                Ya podés volver a Surco con tu cuenta confirmada.
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: autenticado ? "/" : "/login" })}
                className="mt-4 text-[11.5px] font-semibold text-primary"
              >
                {autenticado ? "Volver al panel" : "Iniciar sesión"}
              </button>
            </>
          ) : (
            <>
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-[13.5px] font-semibold text-foreground">Este link no es válido</p>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-muted-foreground">
                Puede haber vencido o ya haberse usado. Podés pedir uno nuevo desde el panel, una vez que
                inicies sesión.
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: autenticado ? "/" : "/login" })}
                className="mt-4 text-[11.5px] font-semibold text-primary"
              >
                {autenticado ? "Volver al panel" : "Iniciar sesión"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
