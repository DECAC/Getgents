import { adresseAutorisee, apercuMontre, captureAJour, cheminCapture } from "@/lib/apercuCapture";

describe("adresses joignables par le navigateur de capture", () => {
  it("laisse passer le web public, data: et blob:", () => {
    for (const u of ["https://esm.sh/react@18", "https://fonts.googleapis.com/css2?family=Inter", "http://example.com/a.png", "data:image/png;base64,AAAA", "blob:null/1234"])
      expect(adresseAutorisee(u)).toBe(true);
  });
  it("refuse localhost, réseaux privés, métadonnées du nuage et protocoles exotiques", () => {
    for (const u of [
      "http://localhost:3000/api/pages",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://172.16.3.4/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://100.64.0.1/",
      "http://[::1]/",
      "http://[fd00::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://service.internal/",
      "file:///etc/passwd",
      "ftp://example.com/",
      "pas une adresse",
    ])
      expect(adresseAutorisee(u)).toBe(false);
  });
});

describe("quand montrer la capture", () => {
  const etat = { actif: true, version: 3, captureLe: "2026-11-25T08:00:00Z" };
  it("seulement si l'option est active, la capture à jour et la page non protégée", () => {
    expect(apercuMontre(etat, 3, false)).toBe(true);
    expect(apercuMontre(etat, 4, false)).toBe(false);
    expect(apercuMontre(etat, 3, true)).toBe(false);
    expect(apercuMontre({ ...etat, actif: false }, 3, false)).toBe(false);
    expect(apercuMontre(null, 3, false)).toBe(false);
  });
  it("à jour = même version", () => {
    expect(captureAJour(etat, 3)).toBe(true);
    expect(captureAJour({ ...etat, version: null }, 3)).toBe(false);
  });
  it("une image par page et par version", () => {
    expect(cheminCapture("abc", 2)).toBe("abc/v2.png");
  });
});
