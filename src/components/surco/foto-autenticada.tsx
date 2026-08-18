import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BASE_URL, leerTokens } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * GET /scouting/fotos/:fotoId/archivo exige Authorization: Bearer
 * (JwtAuthGuard) — un <img src="..."> plano no puede mandar ese header
 * (mismo problema documentado en CLAUDE.md §11 para las imágenes de
 * email). Hace el fetch a mano, arma un blob URL, y lo limpia al
 * desmontar.
 */
export function FotoAutenticada({ fotoId, className }: { fotoId: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let objectUrl: string | null = null;
    const tokens = leerTokens();

    fetch(`${BASE_URL}/scouting/fotos/${fotoId}/archivo`, {
      headers: tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fotoId]);

  if (error) {
    return <div className={cn("grid place-items-center bg-secondary text-xs text-muted-foreground", className)}>Error</div>;
  }
  if (!url) {
    return (
      <div className={cn("grid place-items-center bg-secondary", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <img src={url} className={cn("object-cover", className)} alt="" />;
}
