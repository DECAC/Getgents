/**
 * L'interface VOUVOIE, partout (décision du 12/11) : GetSpace tutoyait
 * (« Interroge tes gents ») quand le studio et l'accueil vouvoyaient.
 *
 * On cherche, dans les libellés des composants (chaînes et texte JSX, hors
 * commentaires), les pronoms du tutoiement sans ambiguïté : tu, tes, toi, t'.
 * « ton » et « ta » sont écartés — « le ton du gent » est un nom. Les
 * exemples de PROMPT parlent au modèle, pas à l'utilisateur : ils sont listés.
 */
import fs from "node:fs";
import path from "node:path";

const AUTORISES = [
  "Tu es [nom du gent] de Getgents.", // exemple de prompt système (PromptTab)
  "Quelles sont tes disponibilités ?", // exemple de question posée aux participants d'un salon
];

// Lettres françaises écrites en clair : le drapeau `u` (\p{L}) n'est pas
// accepté par la cible de compilation du projet.
const L = "a-zA-ZÀ-ÖØ-öø-ÿŒœ";
const TUTOIEMENT = new RegExp(`(^|[^${L}])(tu|tes|toi|t['’](?=[${L}]))(?=$|[^${L}'’])`, "i");

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const nom of fs.readdirSync(dossier)) {
    const p = path.join(dossier, nom);
    if (fs.statSync(p).isDirectory()) fichiers(p, sortie);
    else if (nom.endsWith(".tsx")) sortie.push(p);
  }
  return sortie;
}

function libelles(source: string): string[] {
  const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const sortie: string[] = [];
  const re = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`|>([^<>{}]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sansCommentaires))) {
    const t = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (/\s/.test(t)) sortie.push(t);
  }
  return sortie;
}

describe("l'interface vouvoie", () => {
  it("aucun libellé de composant ne tutoie", () => {
    const fautes: string[] = [];
    for (const f of fichiers(path.join(__dirname, "..", "components"))) {
      if (f.includes(`${path.sep}prototype${path.sep}`)) continue; // maquettes hors produit
      for (const t of libelles(fs.readFileSync(f, "utf8"))) {
        if (TUTOIEMENT.test(t) && !AUTORISES.some((a) => t.includes(a))) fautes.push(`${path.relative(process.cwd(), f)} : ${t.slice(0, 80)}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it("le détecteur reconnaît le tutoiement et laisse passer le ton", () => {
    expect(TUTOIEMENT.test("Interroge tes gents")).toBe(true);
    expect(TUTOIEMENT.test("Si tu veux")).toBe(true);
    expect(TUTOIEMENT.test("Le ton du gent")).toBe(false);
    expect(TUTOIEMENT.test("Interrogez vos gents")).toBe(false);
    expect(TUTOIEMENT.test("Pour les dirigeants, tutoiement")).toBe(false);
  });
});
