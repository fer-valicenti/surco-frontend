import { useState } from "react";
import { Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";

/**
 * Verificación no bloqueante (ver CLAUDE.md del backend, §13): el
 * usuario ya puede usar la app, esto solo avisa hasta que confirme el
 * mail. Insertado una sola vez en AuthGate — así cubre tanto el shell
 * de escritorio como el mobile-home sin duplicar el componente.
 */
export function VerificarEmailBanner() {
  const { usuario, reenviarVerificacion } = useAuth();
  const [enviando, setEnviando] = useState(false);

  if (!usuario || usuario.emailVerificadoEn) return null;

  const reenviar = async () => {
    setEnviando(true);
    const resultado = await reenviarVerificacion();
    setEnviando(false);
    if (resultado.ok) {
      toast.success("Te reenviamos el mail de verificación");
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2.5 bg-warn/15 px-4 py-2 text-center text-[12px] text-warn-foreground">
      <MailWarning className="h-3.5 w-3.5 shrink-0 text-warn" />
      <span>Confirmá tu email para no perderte notificaciones.</span>
      <button
        type="button"
        onClick={reenviar}
        disabled={enviando}
        className="flex shrink-0 items-center gap-1 font-semibold text-primary disabled:opacity-60"
      >
        {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Reenviar
      </button>
    </div>
  );
}
