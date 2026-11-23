"use client";

import { adresseDirecte, useCadreAvecRepli } from "@/components/shared/useCadreAvecRepli";
import { useStockagePartage } from "@/components/shared/useStockagePartage";

/** Aperçu d'une page dans la fiche, avec le repli si le domaine de contenu est bloqué. */
export function CadreApercu({
  src,
  titre,
  className,
  stockage,
}: {
  src: string;
  titre: string;
  className?: string;
  /** Page de l'auteur : son `window.storage` partagé (votes…) est relayé, comme chez un lecteur. */
  stockage?: { url: string; portee: string };
}) {
  const repli = useCadreAvecRepli(src);
  useStockagePartage(repli.cadre, stockage?.url, stockage?.portee ?? "");
  return (
    <iframe
      ref={repli.cadre}
      className={className}
      src={repli.direct ? adresseDirecte(src) : src}
      onLoad={repli.onLoad}
      title={titre}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals"
      referrerPolicy="no-referrer"
    />
  );
}
