import { Download, Share } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

/**
 * Alta a pantalla de inicio. En Android/Chrome/Edge disparamos el prompt
 * nativo del navegador; en iOS Safari no existe ese evento — ahí se guía a
 * mano (Compartir → Agregar a inicio). Si ya está instalada o el navegador
 * no soporta ninguna de las dos vías, no renderiza nada.
 */
export function InstallApp() {
  const { puedeInstalar, puedeGuiarIos, instalar } = useInstallPrompt();

  if (!puedeInstalar && !puedeGuiarIos) return null;

  if (puedeGuiarIos) {
    return (
      <div className="mt-4 flex items-start gap-1.5 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5 text-[10.5px] leading-[1.4] text-muted-foreground">
        <Share className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        Para instalarla: tocá el botón Compartir de Safari y elegí «Agregar a inicio».
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={instalar}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-[11px] border-[1.4px] border-primary/35 bg-primary/10 py-2.5 text-[12.5px] font-bold text-primary transition-transform active:scale-[0.98]"
    >
      <Download className="h-4 w-4" />
      Instalar app en este dispositivo
    </button>
  );
}
