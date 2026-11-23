"use client";

import { useEffect, useMemo, useState } from "react";
import { cheminQr, echelleEntiere, matriceQr, nomFichierQr, pixelsDuQr, svgDuQr, tailleModules } from "@/lib/qrCode";
import { etatEcheance, texteExpireDans } from "@/lib/dureeLien";
import styles from "./pages.module.css";

const jourLong = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** Côté visé du PNG téléchargé : assez grand pour une impression nette, sans module flou. */
const COTE_PNG = 1000;

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** PNG du QR : canevas aux pixels exacts (échelle entière), rendu dans le navigateur. */
function pngDuQr(lien: string): Promise<Blob | null> {
  const m = matriceQr(lien);
  const { largeur, data } = pixelsDuQr(m, echelleEntiere(m, COTE_PNG));
  const c = document.createElement("canvas");
  c.width = c.height = largeur;
  c.getContext("2d")?.putImageData(new ImageData(data, largeur, largeur), 0, 0);
  return new Promise((r) => c.toBlob(r, "image/png"));
}

/**
 * Fenêtre « QR code » d'un lien (lot « Partager », 23/11). Le QR est calculé
 * ICI, dans le navigateur de l'auteur : le lien n'est envoyé à personne.
 * Elle dit jusqu'à quand il fonctionne — un QR imprimé ou projeté cesse de
 * marcher quand le lien expire — et propose de le prolonger : le QR ne
 * change pas, ce qui est déjà imprimé continue de s'ouvrir.
 */
export function FenetreQr({
  lien,
  destinataire,
  titrePage,
  expiresAt,
  protegee,
  onFermer,
  onProlonger,
  onMessage,
}: {
  lien: string;
  destinataire: string;
  titrePage: string;
  /** Échéance du lien ; null si on vient de le créer (30 jours). */
  expiresAt: string | null;
  /** Accès par code activé ET lien adressé à une adresse e-mail : le QR seul n'ouvre rien. */
  protegee: boolean;
  onFermer: () => void;
  /** Prolonge le lien ; rend la nouvelle échéance, ou null en cas d'échec. Absent : pas de bouton. */
  onProlonger?: () => Promise<string | null>;
  onMessage: (m: string) => void;
}) {
  const matrice = useMemo(() => matriceQr(lien), [lien]);
  const t = tailleModules(matrice);
  const [echeance, setEcheance] = useState(expiresAt);
  const [enCours, setEnCours] = useState(false);
  const [maintenant] = useState(() => Date.now());
  const etat = echeance ? etatEcheance({ expiresAt: echeance, revokedAt: null }, maintenant) : "actif";

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  const png = async () => {
    const b = await pngDuQr(lien);
    if (!b) return onMessage("Le PNG n'a pas pu être créé.");
    telecharger(b, nomFichierQr(destinataire, "png"));
  };
  const svg = () => telecharger(new Blob([svgDuQr(matrice)], { type: "image/svg+xml" }), nomFichierQr(destinataire, "svg"));
  const copierImage = async () => {
    try {
      const b = await pngDuQr(lien);
      if (!b || !navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("non pris en charge");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
      onMessage("Image copiée.");
    } catch {
      onMessage("La copie d'image n'est pas disponible ici : utilisez « Télécharger PNG ».");
    }
  };
  const prolonger = async () => {
    if (!onProlonger) return;
    setEnCours(true);
    const e = await onProlonger();
    setEnCours(false);
    if (e) setEcheance(e);
  };

  return (
    <div className={styles.importVoile} onClick={onFermer}>
      <div className={styles.qrFenetre} role="dialog" aria-modal="true" aria-labelledby="qr-titre" onClick={(e) => e.stopPropagation()}>
        <div className={styles.importTete}>
          <h2 id="qr-titre">QR code · {destinataire}</h2>
          <button type="button" className={styles.importFermer} aria-label="Fermer" onClick={onFermer}>
            ✕
          </button>
        </div>
        <div className={styles.qrCorps}>
          <p className={styles.aide}>{titrePage}</p>
          <div className={styles.qrCadre}>
            <svg viewBox={`0 0 ${t} ${t}`} shapeRendering="crispEdges" role="img" aria-label={`QR code du lien envoyé à ${destinataire}`} className={styles.qrImage}>
              <rect width={t} height={t} fill="#fff" />
              <path d={cheminQr(matrice)} fill="#000" />
            </svg>
            <small>Scannez avec l&apos;appareil photo d&apos;un téléphone</small>
          </div>

          {etat === "bientot" && echeance && (
            <p className={styles.qrEcheance} data-etat="bientot">
              ⏳ Ce lien {texteExpireDans(echeance, maintenant)} ({jourLong(echeance)}). Après, ce QR code ne fonctionnera plus.
            </p>
          )}
          {etat === "expire" && echeance && (
            <p className={styles.qrEcheance} data-etat="expire">
              Ce lien a expiré le {jourLong(echeance)} : ce QR code ne s&apos;ouvre plus.
            </p>
          )}
          {etat === "actif" && (
            <p className={styles.qrEcheance} data-etat="ok">
              ✓ Ce QR code fonctionne {echeance ? <>jusqu&apos;au <b>{jourLong(echeance)}</b>.</> : <>pendant 30 jours.</>}
            </p>
          )}
          {onProlonger && (etat === "bientot" || etat === "expire") && (
            <div className={styles.ligne}>
              <button type="button" className={styles.principal} disabled={enCours} onClick={prolonger}>
                {enCours ? "Prolongation…" : "Prolonger de 30 jours"}
              </button>
            </div>
          )}
          {onProlonger && (etat === "bientot" || etat === "expire") && (
            <p className={styles.aide}>Le QR code ne change pas : un QR déjà imprimé ou envoyé continue de fonctionner.</p>
          )}

          <div className={styles.ligne}>
            <button type="button" className={styles.principal} onClick={() => void png()}>
              Télécharger PNG
            </button>
            <button type="button" className={styles.secondairePetit} onClick={svg}>
              Télécharger SVG
            </button>
            <button type="button" className={styles.secondairePetit} onClick={() => void copierImage()}>
              Copier l&apos;image
            </button>
          </div>
          <p className={styles.aide}>PNG pour une présentation ou un message ; SVG pour une impression nette à toute taille.</p>

          {protegee ? (
            <p className={styles.alerteBloc}>
              <b>Page protégée par code.</b> Même avec ce QR code, seul le destinataire, à l&apos;adresse enregistrée sur son lien, peut ouvrir la page.
            </p>
          ) : (
            <p className={styles.alerteBloc}>Toute personne qui scanne ce QR code ouvre la page : affichez-le comme vous enverriez le lien.</p>
          )}
        </div>
      </div>
    </div>
  );
}
