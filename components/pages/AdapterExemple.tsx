"use client";

import { useState } from "react";
import { consigneAdaptation, type ExemplePage } from "@/lib/exemplesPages";
import { ImportPage } from "./ImportPage";
import styles from "./pages.module.css";

/**
 * « Adapter avec mon IA » (19/11) : reprendre un exemple avec SES données.
 * Getgents ne fait pas l'adaptation (aucun appel au modèle, rien à facturer) :
 * on copie une consigne + le code, l'IA de l'utilisateur adapte, il recolle
 * le résultat — en NOUVELLE page, l'exemple reste intact.
 */
export function AdapterExemple({ exemple, onFermer, onMessage }: { exemple: ExemplePage; onFermer: () => void; onMessage: (m: string) => void }) {
  const [copie, setCopie] = useState(false);
  const [coller, setColler] = useState(false);

  if (coller) return <ImportPage onFermer={onFermer} />;

  const copier = () =>
    void navigator.clipboard?.writeText(consigneAdaptation(exemple)).then(
      () => {
        setCopie(true);
        onMessage("Consigne et code copiés.");
      },
      () => onMessage("La copie a échoué. Réessayez.")
    );

  return (
    <div className={styles.importVoile} onClick={onFermer}>
      <div className={styles.adapterFenetre} role="dialog" aria-modal="true" aria-labelledby="adapter-titre" onClick={(e) => e.stopPropagation()}>
        <div className={styles.importTete}>
          <h2 id="adapter-titre">Adapter « {exemple.titre} » avec votre IA</h2>
          <button type="button" className={styles.importFermer} aria-label="Fermer" onClick={onFermer}>
            ✕
          </button>
        </div>
        <ol className={styles.adapterEtapes}>
          <li data-fait={copie ? "oui" : "non"}>
            <b>Copiez la consigne et le code de l&apos;exemple</b>
            <span>La consigne demande de garder la mise en page et l&apos;interactivité, et de tout remplacer par vos informations.</span>
            <button type="button" className={copie ? styles.secondaire : styles.principal} onClick={copier}>
              {copie ? "✓ Copié — recopier" : "Copier la consigne et le code"}
            </button>
          </li>
          <li>
            <b>Collez-les dans Claude, ChatGPT ou Mistral</b>
            <span>
              Remplacez la ligne « Mes informations » par les vôtres : client, offre, prix, dates… Ne donnez que ce que vos lecteurs peuvent voir.
            </span>
          </li>
          <li>
            <b>Collez ici la page qu&apos;il vous rend</b>
            <span>Elle devient une nouvelle page, avec ses propres liens. L&apos;exemple reste tel quel.</span>
            <button type="button" className={styles.secondaire} onClick={() => setColler(true)}>
              Coller la page adaptée
            </button>
          </li>
        </ol>
      </div>
    </div>
  );
}
