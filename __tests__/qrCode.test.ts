import jsQR from "jsqr";
import { cheminQr, echelleEntiere, matriceQr, nomFichierQr, pixelsDuQr, svgDuQr, tailleModules } from "@/lib/qrCode";
import { DUREE_LIEN_MS, JOUR_MS, etatEcheance, liensQuiExpirent, nouvelleEcheance, peutProlonger, texteExpireDans } from "@/lib/dureeLien";

const LIEN = "https://getgents.ai/partage/Td_Xrohjl4eASGmwEtsedI1PrDVCRZdq";

describe("QR code d'un lien", () => {
  it("la matrice est carrée, avec les trois repères aux coins", () => {
    const m = matriceQr(LIEN);
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((l) => l.length === m.length)).toBe(true);
    // Repère : bordure noire 7×7, anneau blanc, centre noir.
    for (const [ox, oy] of [[0, 0], [m.length - 7, 0], [0, m.length - 7]]) {
      expect(m[oy][ox]).toBe(true);
      expect(m[oy + 1][ox + 1]).toBe(false);
      expect(m[oy + 3][ox + 3]).toBe(true);
    }
  });

  it("se RELIT : le code décodé redonne exactement le lien (échelles 4 et 12)", () => {
    const m = matriceQr(LIEN);
    for (const e of [4, 12]) {
      const { largeur, data } = pixelsDuQr(m, e);
      const r = jsQR(data, largeur, largeur);
      expect(r?.data).toBe(LIEN);
    }
  });

  it("un lien long, avec une version plus grande, se relit aussi", () => {
    const long = `${LIEN}?x=${"a".repeat(120)}`;
    const m = matriceQr(long);
    const { largeur, data } = pixelsDuQr(m, 6);
    expect(jsQR(data, largeur, largeur)?.data).toBe(long);
  });

  it("le SVG a la zone de silence et autant de modules noirs que la matrice", () => {
    const m = matriceQr(LIEN);
    const svg = svgDuQr(m);
    const t = tailleModules(m);
    expect(t).toBe(m.length + 8);
    expect(svg).toContain(`viewBox="0 0 ${t} ${t}"`);
    expect(svg).toContain('fill="#fff"');
    // Chaque ligne du chemin est une série de modules : leur somme = modules noirs.
    const noirs = m.flat().filter(Boolean).length;
    const somme = Array.from(cheminQr(m).matchAll(/h(\d+)v1/g)).reduce((n, x) => n + Number(x[1]), 0);
    expect(somme).toBe(noirs);
  });

  it("échelle entière proche de la cible, jamais nulle", () => {
    const m = matriceQr(LIEN);
    expect(echelleEntiere(m, 1000) * tailleModules(m)).toBeGreaterThan(900);
    expect(echelleEntiere(m, 1)).toBe(1);
  });

  it("nom de fichier ASCII", () => {
    expect(nomFichierQr("Marie Dupré", "png")).toBe("qr-marie-dupre.png");
    expect(nomFichierQr("", "svg")).toBe("qr-page.svg");
  });
});

describe("échéance et prolongation d'un lien", () => {
  const T = Date.parse("2026-11-23T10:00:00Z");
  const dans = (j: number) => new Date(T + j * JOUR_MS).toISOString();

  it("nouvelle échéance = aujourd'hui + 30 jours", () => {
    expect(Date.parse(nouvelleEcheance(T)) - T).toBe(DUREE_LIEN_MS);
  });

  it("états : révoqué, expiré, bientôt (< 7 jours), actif", () => {
    expect(etatEcheance({ expiresAt: dans(20), revokedAt: null }, T)).toBe("actif");
    expect(etatEcheance({ expiresAt: dans(6.9), revokedAt: null }, T)).toBe("bientot");
    expect(etatEcheance({ expiresAt: dans(7.1), revokedAt: null }, T)).toBe("actif");
    expect(etatEcheance({ expiresAt: dans(-1), revokedAt: null }, T)).toBe("expire");
    expect(etatEcheance({ expiresAt: dans(20), revokedAt: dans(-2) }, T)).toBe("revoque");
  });

  it("un lien révoqué ne se prolonge jamais ; un lien expiré, si", () => {
    expect(peutProlonger({ expiresAt: dans(-1), revokedAt: null })).toBe(true);
    expect(peutProlonger({ expiresAt: dans(3), revokedAt: dans(-1) })).toBe(false);
  });

  it("textes lisibles", () => {
    expect(texteExpireDans(dans(0.5), T)).toBe("expire dans moins de 24 h");
    expect(texteExpireDans(dans(2.2), T)).toBe("expire dans 3 jours");
  });

  it("le bandeau ne prend que les liens actifs qui expirent bientôt", () => {
    const liens = [
      { id: "a", expiresAt: dans(3), revokedAt: null },
      { id: "b", expiresAt: dans(25), revokedAt: null },
      { id: "c", expiresAt: dans(-2), revokedAt: null },
      { id: "d", expiresAt: dans(2), revokedAt: dans(-1) },
    ];
    expect(liensQuiExpirent(liens, T).map((l) => l.id)).toEqual(["a"]);
  });
});
