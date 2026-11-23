import { avecFichiers, FICHIER_MAX, FICHIERS_MAX, FICHIERS_TOTAL_MAX, fichiersReferences, nomFichierValide, typeDepuisNom, validerFichier } from "@/lib/fichiersPage";
import { controleFidelite } from "@/lib/mcpPartage";

const PAGE_VOTE = `<!doctype html><html><body>
<audio src="musique.mp3" controls></audio>
<img src='/mnt/user-data/uploads/photo%20groupe.jpg' alt="">
<div style="background:url(fond.png)"></div>
<img src="https://cdn.exemple.com/logo.png">
<img src="data:image/png;base64,AAAA">
<script>const piste = "musique.mp3"; const doc = 'notice.pdf?v=2';</script>
</body></html>`;

describe("fichiers joints d'une page (23/11)", () => {
  it("repère les fichiers LOCAUX appelés par la page, sans les adresses web ni data:", () => {
    expect(fichiersReferences(PAGE_VOTE)).toEqual(["musique.mp3", "photo groupe.jpg", "fond.png", "notice.pdf"]);
    expect(fichiersReferences("<p>Aucun média</p>")).toEqual([]);
  });

  it("réécrit les références vers les adresses des fichiers joints, et rien d'autre", () => {
    const sortie = avecFichiers(PAGE_VOTE, [
      { nom: "musique.mp3", url: "https://s.example/sign/a.mp3?token=X" },
      { nom: "photo groupe.jpg", url: "https://s.example/sign/b.jpg?token=Y" },
      { nom: "logo.png", url: "https://s.example/NE-DOIT-PAS-SERVIR" },
    ]);
    expect(sortie).toContain('<audio src="https://s.example/sign/a.mp3?token=X"');
    expect(sortie).toContain('const piste = "https://s.example/sign/a.mp3?token=X"');
    expect(sortie).toContain("src='https://s.example/sign/b.jpg?token=Y'");
    expect(sortie).toContain('src="https://cdn.exemple.com/logo.png"'); // externe : intact
    expect(sortie).not.toContain("NE-DOIT-PAS-SERVIR");
    expect(sortie).toContain("url(fond.png)"); // non joint : intact
    expect(avecFichiers(PAGE_VOTE, [])).toBe(PAGE_VOTE);
  });

  it("valide nom, type, taille et plafonds (un remplacement ne compte qu'une fois)", () => {
    expect(nomFichierValide("musique.mp3")).toBe(true);
    expect(nomFichierValide("../etc/passwd.mp3")).toBe(false);
    expect(nomFichierValide("page.html")).toBe(false);
    expect(validerFichier({ nom: "a.mp3", type: "audio/mpeg", taille: 5_000_000 }, [])).toBeNull();
    expect(validerFichier({ nom: "a.mp3", type: "text/html", taille: 10 }, [])).toBe("type");
    expect(validerFichier({ nom: "a.mp3", type: "audio/mpeg", taille: FICHIER_MAX + 1 }, [])).toBe("taille");
    const pleins = Array.from({ length: FICHIERS_MAX }, (_, i) => ({ nom: `f${i}.png`, taille: 10 }));
    expect(validerFichier({ nom: "x.png", type: "image/png", taille: 10 }, pleins)).toBe("nombre");
    expect(validerFichier({ nom: "f1.png", type: "image/png", taille: 10 }, pleins)).toBeNull();
    const lourds = [{ nom: "a.mp4", taille: FICHIERS_TOTAL_MAX - 100 }];
    expect(validerFichier({ nom: "b.mp3", type: "audio/mpeg", taille: 200 }, lourds)).toBe("total");
    expect(validerFichier({ nom: "a.mp4", type: "video/mp4", taille: 200 }, lourds)).toBeNull();
  });

  it("devine le type d'après l'extension quand le navigateur n'en donne pas", () => {
    expect(typeDepuisNom("Chanson.M4A")).toBe("audio/mp4");
    expect(typeDepuisNom("x.exe")).toBe("");
  });

  it("le connecteur signale les fichiers à joindre", () => {
    expect(controleFidelite(PAGE_VOTE, "html").fichiers).toContain("musique.mp3");
  });
});
