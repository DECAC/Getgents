import { noteDepuisReponse } from "@/lib/noteDepuisReponse";
// Le HTML ci-dessous reproduit la sortie de `renderMarkdown` (marked) :
// Jest ne charge pas `marked`, module ESM.
const note = noteDepuisReponse;

describe("garder une réponse en note (copie fidèle)", () => {
  it("garde le texte tel quel, listes comprises, en markdown", () => {
    const n = note("<p>Meta lance <strong>Muse</strong>, un agent personnel.</p>\n<ul>\n<li>Gratuit jusqu&#39;à 100 M de jetons</li>\n<li>iOS, Android, WhatsApp</li>\n</ul>\n");
    expect(n).not.toBeNull();
    const texte = n!.dashboard.blocks.filter((b) => b.type === "text").map((b) => (b as { body: string }).body).join("\n");
    expect(texte).toContain("Meta lance **Muse**, un agent personnel.");
    expect(texte).toContain("- Gratuit jusqu'à 100 M de jetons");
    expect(texte).toContain("- iOS, Android, WhatsApp");
  });

  it("un titre devient un bloc titre, et le titre de la note", () => {
    const n = note("<h2>Newsletters IA</h2>\n<p>The Batch parle de Muse.</p>\n");
    expect(n!.title).toBe("Newsletters IA");
    expect(n!.dashboard.blocks[0]).toMatchObject({ type: "heading", text: "Newsletters IA" });
  });

  it("sans titre, la première phrase nomme la note", () => {
    expect(note("<p>Andrew Ng juge ces scénarios irréalistes. Il plaide pour l&#39;ingénierie.</p>")!.title).toBe(
      "Andrew Ng juge ces scénarios irréalistes"
    );
  });

  it("un titre trop long est coupé proprement", () => {
    const t = note("<p>" + "x".repeat(200) + "</p>")!.title;
    expect(t.length).toBeLessThanOrEqual(80);
    expect(t.endsWith("…")).toBe(true);
  });

  it("un tableau devient un bloc tableau", () => {
    const n = note("<table>\n<thead>\n<tr>\n<th>Source</th>\n<th>Sujet</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>The Batch</td>\n<td>Agents</td>\n</tr>\n<tr>\n<td>AI Secret</td>\n<td>Outils</td>\n</tr>\n</tbody></table>\n");
    const t = n!.dashboard.blocks.find((b) => b.type === "table") as { columns: string[]; rows: string[][] };
    expect(t.columns).toEqual(["Source", "Sujet"]);
    expect(t.rows).toEqual([["The Batch", "Agents"], ["AI Secret", "Outils"]]);
  });

  it("les liens web restent des liens, les autres sont réduits à leur texte", () => {
    const n = note('<p>Voir <a href="https://deeplearning.ai/the-batch">l&#39;article</a> et <a href="javascript:alert(1)">ceci</a>.</p>');
    const body = (n!.dashboard.blocks[0] as { body: string }).body;
    expect(body).toContain("[l'article](https://deeplearning.ai/the-batch)");
    expect(body).not.toContain("javascript:");
  });

  it("aucune balise HTML n'entre dans la note", () => {
    const n = noteDepuisReponse('<p>Texte <span onclick="x()">piégé</span> <img src=x onerror=alert(1)></p>');
    expect(JSON.stringify(n)).not.toMatch(/<(span|img)|onerror|onclick/);
  });

  it("une longue réponse est répartie sur plusieurs blocs, sans rien perdre", () => {
    const paras = Array.from({ length: 12 }, (_, i) => `Paragraphe ${i} ` + "mot ".repeat(90)).join("\n\n");
    const n = note(paras.split("\n\n").map((p) => `<p>${p}</p>`).join("\n"))!;
    const textes = n.dashboard.blocks.filter((b) => b.type === "text") as { body: string }[];
    expect(textes.length).toBeGreaterThan(1);
    for (let i = 0; i < 12; i++) expect(textes.some((t) => t.body.includes(`Paragraphe ${i} `))).toBe(true);
  });

  it("chaque bloc reçoit un identifiant, pour les retouches et les versions", () => {
    const n = note("<h2>A</h2>\n<p>Texte.</p>");
    expect(n!.dashboard.blocks.every((b) => typeof b.id === "string" && b.id.length > 0)).toBe(true);
  });

  it("une réponse vide ne donne pas de note", () => {
    expect(noteDepuisReponse("")).toBeNull();
    expect(noteDepuisReponse("<p> </p>")).toBeNull();
  });
});

describe("fidélité des caractères spéciaux", () => {
  it("un « <script> » écrit en toutes lettres reste lisible, sans devenir une balise", () => {
    const n = note("<p>La balise &lt;script&gt; est bloquée &amp; journalisée.</p>");
    const body = (n!.dashboard.blocks[0] as { body: string }).body;
    expect(body).toBe("La balise &lt;script&gt; est bloquée &amp; journalisée.");
  });

  it("dans un titre (texte brut), les entités sont décodées", () => {
    expect(note("<h2>R&amp;D &amp; IA</h2><p>x</p>")!.title).toBe("R&D & IA");
  });
});

it("sans titre, la première phrase décodée nomme la note", () => {
  expect(noteDepuisReponse("<p>R&amp;D : trois pistes.</p>")!.title).toBe("R&D");
});
