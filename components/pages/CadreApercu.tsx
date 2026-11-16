"use client";

import { adresseDirecte, useCadreAvecRepli } from "@/components/shared/useCadreAvecRepli";

/** Aperçu d'une page dans la fiche, avec le repli si le domaine de contenu est bloqué. */
export function CadreApercu({ src, titre, className }: { src: string; titre: string; className?: string }) {
  const repli = useCadreAvecRepli(src);
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
