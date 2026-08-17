import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/recuperar-password")({
  component: RecuperarPasswordPage,
});

function RecuperarPasswordPage() {
  const navigate = useNavigate();
  const { solicitarRecuperacion } = useAuth();

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if (!email.trim()) {
      toast.error("Ingresá tu email");
      return;
    }
    setEnviando(true);
    const resultado = await solicitarRecuperacion(email.trim());
    setEnviando(false);
    if (resultado.ok) {
      setEnviado(true);
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
        <p className="mt-1.5 text-xs text-surface-ink-foreground/65">Recuperar contraseña</p>
      </div>

      <div className="-mt-6 flex-1 rounded-t-[26px] bg-card px-6 pb-8 pt-7 shadow-[0_-8px_24px_rgba(22,48,42,0.06)] sm:mx-auto sm:w-full sm:max-w-sm">
        {enviado ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-ok/15 text-ok">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-[13.5px] font-semibold text-foreground">Revisá tu correo</p>
            <p className="mt-1.5 text-[12px] leading-[1.5] text-muted-foreground">
              Si ese email está registrado, te enviamos un link para elegir una contraseña nueva.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-5 text-[12.5px] leading-[1.5] text-muted-foreground">
              Ingresá el email de tu cuenta y te mandamos un link para restablecer tu contraseña.
            </p>
            <div className="mb-4">
              <span className="label-field mb-2 block">Email</span>
              <div className="flex items-center gap-2.5 rounded-[10px] border-[1.4px] border-border bg-muted/40 px-3 py-2.5 focus-within:border-primary focus-within:bg-card">
                <Mail className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@ejemplo.com"
                  autoComplete="username"
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
              Enviar link
            </button>
          </>
        )}

        <p className="mt-6 text-center text-[11.5px] text-muted-foreground">
          <button type="button" onClick={() => navigate({ to: "/login" })} className="font-semibold text-primary">
            Volver a iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}
