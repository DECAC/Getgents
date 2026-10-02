/**
 * Une image de la vidéo habillée, dessinée sur un canevas. La MÊME fonction
 * sert l'aperçu et l'export : l'aperçu ne ment pas sur le résultat.
 */

import {
  couleurAccent,
  DUREE_CARTON,
  facteurZoom,
  FILTRES_ETALONNAGE,
  motAffiche,
  repartirLignes,
  sousTitreA,
  type ReglagesHabillage,
  type SousTitre,
} from "@/lib/habillage";
import { normaliserMot } from "@/lib/prompteur";

export const POLICE = '"Sora", system-ui, -apple-system, "Segoe UI", sans-serif';

export interface DonneesRendu {
  blocs: SousTitre[];
  debuts: number[];
  dureeVideo: number;
  titre: string;
  texteFin: string;
  /** Secondes : positif = sous-titres plus tard. */
  decalage: number;
}

/** `ctx.filter` manque à certains navigateurs (Safari ancien) : l'étalonnage y est sauté. */
export function filtreDisponible(ctx: CanvasRenderingContext2D): boolean {
  return "filter" in ctx;
}

function rectangleArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

/** Texte cerné de noir : lisible sur n'importe quelle image. */
function texteCerne(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, taille: number, couleur: string) {
  ctx.lineJoin = "round";
  ctx.lineWidth = taille * 0.16;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(texte, x, y);
  ctx.fillStyle = couleur;
  ctx.fillText(texte, x, y);
}

function bandeauTitre(ctx: CanvasRenderingContext2D, w: number, base: number, titre: string, accent: string): number {
  const taille = base * 0.048;
  ctx.font = `700 ${taille}px ${POLICE}`;
  const lignes = repartirLignes(titre.split(/\s+/).filter(Boolean), (t) => ctx.measureText(t).width, w * 0.8, 2);
  const hauteurLigne = taille * 1.25;
  const marge = taille * 0.6;
  const largeur = Math.max(...lignes.map((l) => ctx.measureText(l.join(" ")).width)) + marge * 2 + taille * 0.35;
  const hauteur = lignes.length * hauteurLigne + marge * 1.4;
  const x = (w - largeur) / 2;
  const y = base * 0.05;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  rectangleArrondi(ctx, x, y, largeur, hauteur, taille * 0.4);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(x + marge * 0.6, y + marge * 0.7, taille * 0.14, hauteur - marge * 1.4);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  lignes.forEach((l, i) => ctx.fillText(l.join(" "), x + marge + taille * 0.35, y + marge * 0.7 + hauteurLigne * (i + 0.5)));
  return y + hauteur;
}

function sousTitres(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: number,
  t: number,
  r: ReglagesHabillage,
  d: DonneesRendu,
  basBandeau: number
) {
  const bloc = sousTitreA(d.blocs, t);
  const accent = couleurAccent(r.accent);
  const yCentre =
    r.position === "haut" ? Math.max(h * 0.2, basBandeau + base * 0.1) : r.position === "milieu" ? h * 0.64 : h * 0.84;
  ctx.textBaseline = "middle";

  if (r.sousTitres === "motAMot") {
    const mots = d.blocs.flatMap((b) => b.mots);
    const mot = mots.find((m, i) => t >= m.debut && t < Math.max(m.fin, Math.min(m.fin + 0.25, mots[i + 1]?.debut ?? Infinity)));
    if (!mot) return;
    const texte = motAffiche(mot.mot).toUpperCase();
    let taille = base * (r.grande ? 0.13 : 0.1);
    ctx.font = `800 ${taille}px ${POLICE}`;
    const largeur = ctx.measureText(texte).width;
    if (largeur > w * 0.9) {
      taille *= (w * 0.9) / largeur;
      ctx.font = `800 ${taille}px ${POLICE}`;
    }
    // Petit « pop » à l'apparition du mot.
    const k = Math.min(1, (t - mot.debut) / 0.12);
    const echelle = 1.18 - 0.18 * (1 - Math.pow(1 - k, 3));
    const marquant = normaliserMot(mot.mot).length >= 7 || /[?!]$/.test(mot.mot);
    ctx.save();
    ctx.translate(w / 2, yCentre);
    ctx.scale(echelle, echelle);
    ctx.textAlign = "center";
    texteCerne(ctx, texte, 0, 0, taille, marquant ? accent : "#fff");
    ctx.restore();
    return;
  }

  if (!bloc || !bloc.mots.length) return;

  if (r.sousTitres === "karaoke") {
    const taille = base * (r.grande ? 0.074 : 0.06);
    ctx.font = `800 ${taille}px ${POLICE}`;
    const affiches = bloc.mots.map((m) => motAffiche(m.mot).toUpperCase());
    const lignes = repartirLignes(affiches, (s) => ctx.measureText(s).width, w * 0.86, 2);
    const hauteurLigne = taille * 1.2;
    const espace = ctx.measureText(" ").width;
    // Le mot dit en ce moment ; entre deux mots, le dernier commencé.
    let courant = -1;
    bloc.mots.forEach((m, i) => {
      if (m.debut <= t) courant = i;
    });
    let index = 0;
    lignes.forEach((ligne, li) => {
      const largeurs = ligne.map((m) => ctx.measureText(m).width);
      const total = largeurs.reduce((a, b) => a + b, 0) + espace * (ligne.length - 1);
      let x = (w - total) / 2;
      const y = yCentre + (li - (lignes.length - 1) / 2) * hauteurLigne;
      ctx.textAlign = "left";
      ligne.forEach((m, j) => {
        texteCerne(ctx, m, x, y, taille, index === courant ? accent : "#fff");
        x += largeurs[j] + espace;
        index++;
      });
    });
    return;
  }

  // Classique : phrase en casse normale, sur un bandeau sombre.
  const taille = base * (r.grande ? 0.056 : 0.045);
  ctx.font = `600 ${taille}px ${POLICE}`;
  const lignes = repartirLignes(bloc.mots.map((m) => motAffiche(m.mot)), (s) => ctx.measureText(s).width, w * 0.82, 2).map((l) =>
    l.join(" ")
  );
  const hauteurLigne = taille * 1.3;
  const marge = taille * 0.5;
  const largeur = Math.max(...lignes.map((l) => ctx.measureText(l).width)) + marge * 2;
  const hauteur = lignes.length * hauteurLigne + marge;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  rectangleArrondi(ctx, (w - largeur) / 2, yCentre - hauteur / 2, largeur, hauteur, taille * 0.35);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  lignes.forEach((l, i) => ctx.fillText(l, w / 2, yCentre + (i - (lignes.length - 1) / 2) * hauteurLigne));
}

function cartonFin(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, ecoule: number, texte: string, accent: string) {
  const opacite = Math.min(1, ecoule / 0.4);
  ctx.fillStyle = `rgba(12,10,11,${0.8 * opacite})`;
  ctx.fillRect(0, 0, w, h);
  if (!texte.trim()) return;
  ctx.globalAlpha = opacite;
  const [premiere, ...suite] = texte.split("\n").map((l) => l.trim()).filter(Boolean);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const grand = base * 0.068;
  ctx.font = `800 ${grand}px ${POLICE}`;
  const y = h / 2 - (suite.length * base * 0.06) / 2;
  ctx.fillStyle = "#fff";
  ctx.fillText(premiere, w / 2, y, w * 0.9);
  const largeur = Math.min(ctx.measureText(premiere).width, w * 0.9);
  ctx.fillStyle = accent;
  ctx.fillRect((w - largeur * 0.4) / 2, y + grand * 0.7, largeur * 0.4, base * 0.008);
  ctx.font = `600 ${base * 0.042}px ${POLICE}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  suite.forEach((l, i) => ctx.fillText(l, w / 2, y + grand * 1.5 + i * base * 0.06, w * 0.9));
  ctx.globalAlpha = 1;
}

/** Dessine l'image de l'instant `t` (secondes ; au-delà de la vidéo : le carton de fin). */
export function dessiner(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
  t: number,
  r: ReglagesHabillage,
  d: DonneesRendu
) {
  const base = Math.min(w, h);
  const parole = t - d.decalage;
  const accent = couleurAccent(r.accent);
  const enCarton = t >= d.dureeVideo;

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  if (r.etalonnage !== "naturel" && filtreDisponible(ctx)) ctx.filter = FILTRES_ETALONNAGE[r.etalonnage];
  const zoom = r.zooms && !enCarton ? facteurZoom(parole, d.debuts) : 1;
  if (zoom !== 1) {
    // Zoom centré un peu au-dessus du milieu : là où est le visage.
    const cx = w / 2;
    const cy = h * 0.42;
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
  }
  if (video.readyState >= 2) ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  if (enCarton) {
    if (r.cartonFin) cartonFin(ctx, w, h, base, t - d.dureeVideo, d.texteFin, accent);
    return;
  }

  let basBandeau = 0;
  if (r.bandeauTitre && d.titre.trim()) basBandeau = bandeauTitre(ctx, w, base, d.titre, accent);
  if (r.sousTitres !== "aucun") sousTitres(ctx, w, h, base, parole, r, d, basBandeau);
  if (r.progression) {
    const epaisseur = Math.max(3, base * 0.01);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(0, h - epaisseur, w, epaisseur);
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - epaisseur, w * Math.min(1, t / Math.max(d.dureeVideo, 0.01)), epaisseur);
  }
}

export { DUREE_CARTON };
