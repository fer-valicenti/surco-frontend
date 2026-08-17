import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function yaInstalada(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari no tiene display-mode: standalone confiable — expone su propio flag.
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * Alta de instalación PWA. Android/Chrome/Edge disparan `beforeinstallprompt`
 * y permiten instalar mediante código (`instalar()`); iOS Safari nunca
 * dispara ese evento — ahí no hay forma programática, solo se puede guiar
 * al usuario a Compartir → Agregar a pantalla de inicio (`esIos`).
 */
export function useInstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalada, setInstalada] = useState(yaInstalada());

  useEffect(() => {
    const capturarPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    };
    const marcarInstalada = () => setInstalada(true);
    window.addEventListener("beforeinstallprompt", capturarPrompt);
    window.addEventListener("appinstalled", marcarInstalada);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturarPrompt);
      window.removeEventListener("appinstalled", marcarInstalada);
    };
  }, []);

  const esIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") setInstalada(true);
    setEvento(null);
  };

  return {
    puedeInstalar: !instalada && !!evento,
    puedeGuiarIos: !instalada && esIos && !evento,
    instalada,
    instalar,
  };
}
