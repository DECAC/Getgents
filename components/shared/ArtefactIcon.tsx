"use client";

import { useEffect, useState } from "react";
import { isMarkupIcon } from "@/lib/artefactIcon";

/**
 * Icône d'artefact : emoji rendu en texte, SVG assaini avant injection.
 * Voir lib/artefactIcon.ts pour la raison de cette double nature.
 */
export function ArtefactIcon({ icon, className }: { icon: string; className?: string }) {
  const markup = isMarkupIcon(icon);
  const [safe, setSafe] = useState("");

  useEffect(() => {
    if (!markup) {
      setSafe("");
      return;
    }
    let annule = false;
    import("dompurify").then((mod) => {
      // Profil SVG strict : ni script, ni foreignObject, ni gestionnaire
      // d'événement. Une icône n'a besoin que de tracés.
      const clean = mod.default.sanitize(icon, {
        USE_PROFILES: { svg: true, svgFilters: false },
        FORBID_TAGS: ["script", "foreignObject", "a", "use", "image"],
        FORBID_ATTR: ["href", "xlink:href", "style"],
      });
      if (!annule) setSafe(clean);
    });
    return () => {
      annule = true;
    };
  }, [icon, markup]);

  if (!markup) return <div className={className}>{icon}</div>;
  return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
}
