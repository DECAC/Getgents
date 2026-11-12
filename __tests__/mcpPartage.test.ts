import {
  controleFidelite,
  modeleMail,
  traiterMessage,
  validerDemande,
  CONTENU_MAX,
  NOM_OUTIL,
  OUTIL_LISTER,
  OUTIL_METTRE_A_JOUR,
  OUTIL_REVOQUER,
  texteListe,
  filtrerPartages,
  statutPartage,
  type ResumePartage,
  type ContexteMcp,
  type DemandePartage,
} from "@/lib/mcpPartage";
import { AMORCE_ARTEFACT, avecAmorce, chaineJs, CSP_ARTEFACT, documentArtefact } from "@/lib/documentArtefact";
import { SLUGS_RESERVES } from "@/lib/slug";

const PAGE = "<!DOCTYPE html>\n<html><head><title>Offre</title></head><body><h1>Offre</h1></body></html>";

function contexte(): ContexteMcp & { recus: DemandePartage[] } {
  const recus: DemandePartage[] = [];
  return {
    recus,
    enregistrer: async (d) => {
      recus.push(d);
      return { lien: "https://getgents.ai/partage/JETON_DE_TEST_123456789" };
    },
  };
}

const appel = (args: unknown, id = 3) => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name: NOM_OUTIL, arguments: args },
});

describe("protocole MCP", () => {
  it("négocie la version demandée quand il la connaît, sinon la plus récente", async () => {
    const r = (await traiterMessage(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
      contexte()
    )) as { result: { protocolVersion: string; capabilities: unknown } };
    expect(r.result.protocolVersion).toBe("2025-03-26");
    expect(r.result.capabilities).toEqual({ tools: { listChanged: false } });
    const r2 = (await traiterMessage({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, contexte())) as {
      result: { protocolVersion: string };
    };
    expect(r2.result.protocolVersion).toBe("2025-06-18");
  });

  it("ne répond pas aux notifications", async () => {
    expect(await traiterMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, contexte())).toBeNull();
  });

  it("liste UN outil sans contexte de gestion ; le contenu complet est exigé sauf pour une page existante", async () => {
    const r = (await traiterMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, contexte())) as {
      result: { tools: { name: string; description: string; inputSchema: { required: string[] } }[] };
    };
    expect(r.result.tools).toHaveLength(1);
    expect(r.result.tools[0].name).toBe(NOM_OUTIL);
    // Le schéma n'exige que le destinataire : c'est la VALIDATION qui exige le
    // contenu quand aucune page n'est donnée (repartage sans recopie).
    expect(r.result.tools[0].inputSchema.required).toEqual(["destinataire"]);
    expect(r.result.tools[0].description).toMatch(/COMPLET/);
  });

  it("partage : enregistre, rend le lien et le mail, sans prétendre l'envoyer", async () => {
    const ctx = contexte();
    const r = (await traiterMessage(appel({ titre: "Offre", contenu: PAGE, format: "html", destinataire: "marie@exemple.fr" }), ctx)) as {
      result: { content: { text: string }[]; structuredContent: { lien: string; fidelite: { caracteres: number } }; isError?: boolean };
    };
    expect(r.result.isError).toBeUndefined();
    expect(ctx.recus[0].contenu).toBe(PAGE); // à l'identique
    expect(r.result.structuredContent.lien).toMatch(/\/partage\//);
    expect(r.result.structuredContent.fidelite.caracteres).toBe(PAGE.length);
    const texte = r.result.content[0].text;
    expect(texte).toMatch(/aucune trace de troncature/);
    expect(texte).toMatch(/c'est à lui d'envoyer/);
  });

  it("une saisie invalide est un échec d'outil que le modèle peut corriger, pas une erreur de protocole", async () => {
    const r = (await traiterMessage(appel({ titre: "Offre", contenu: "", format: "html", destinataire: "x" }), contexte())) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toMatch(/COMPLET/);
  });

  it("signale les erreurs de protocole", async () => {
    const inconnu = (await traiterMessage({ jsonrpc: "2.0", id: 9, method: "resources/list" }, contexte())) as { error: { code: number } };
    expect(inconnu.error.code).toBe(-32601);
    const outil = (await traiterMessage({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "autre" } }, contexte())) as {
      error: { code: number };
    };
    expect(outil.error.code).toBe(-32602);
    expect(((await traiterMessage({ id: 1, method: "ping" }, contexte())) as { error: { code: number } }).error.code).toBe(-32600);
  });

  it("un enregistrement en panne devient un échec d'outil lisible", async () => {
    const r = (await traiterMessage(appel({ titre: "Offre", contenu: PAGE, format: "html", destinataire: "x" }), {
      enregistrer: async () => {
        throw new Error("base injoignable");
      },
    })) as { result: { isError: boolean } };
    expect(r.result.isError).toBe(true);
  });
});

describe("contrôle de fidélité", () => {
  it("voit une page HTML coupée avant sa fin", () => {
    expect(controleFidelite(PAGE, "html").finPresente).toBe(true);
    expect(controleFidelite(PAGE.slice(0, 60), "html").finPresente).toBe(false);
    expect(controleFidelite("<div><p>Fragment</p></div>", "html").finPresente).toBe(true);
  });

  it("repère les abréviations typiques d'un modèle", () => {
    expect(controleFidelite("function a() {}\n// ... rest of the code\n", "react").abreviationSuspecte).toBe(true);
    expect(controleFidelite("<body><!-- ... --></body>", "html").abreviationSuspecte).toBe(true);
    expect(controleFidelite("[... reste du contenu inchangé]", "markdown").abreviationSuspecte).toBe(true);
    expect(controleFidelite(PAGE, "html").abreviationSuspecte).toBe(false);
  });

  it("repère un artefact qui lit ses données dans Claude, et le signale au modèle", async () => {
    expect(controleFidelite("<script>const r = await window.storage.get('agenda')</script>", "html").dependClaude).toBe(true);
    expect(controleFidelite("<p>Ouvre la page depuis claude.ai pour voir les données.</p>", "html").dependClaude).toBe(true);
    expect(controleFidelite(PAGE, "html").dependClaude).toBe(false);
    const r = (await traiterMessage(
      appel({ titre: "Pilotage", contenu: "<html><body><script>window.claude.complete('x')</script></body></html>", format: "html", destinataire: "x" }),
      contexte()
    )) as { result: { content: { text: string }[] } };
    expect(r.result.content[0].text).toMatch(/version FIGÉE/);
  });

  it("demande une version figée, et une vérification des données personnelles", async () => {
    const r = (await traiterMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, contexte())) as {
      result: { tools: { description: string }[] };
    };
    expect(r.result.tools[0].description).toMatch(/version FIGÉE/);
    expect(r.result.tools[0].description).toMatch(/donnée personnelle/);
  });

  it("compte caractères et lignes, et n'invente pas de fin pour un texte", () => {
    const f = controleFidelite("un\ndeux\ntrois", "texte");
    expect(f).toMatchObject({ caracteres: 13, lignes: 3, finPresente: null });
  });

  it("un composant React coupé au milieu d'une expression est suspect", () => {
    expect(controleFidelite("export default function App() {\n  return <div>ok</div>;\n}", "react").finPresente).toBe(true);
    expect(controleFidelite("export default function App() {\n  return <div>o", "react").finPresente).toBe(false);
  });
});

describe("validation", () => {
  const base = { titre: "Offre", contenu: PAGE, format: "html", destinataire: "Marie Dupont" };
  it("accepte une demande complète et nettoie les espaces", () => {
    const v = validerDemande({ ...base, titre: "  Offre  ", message: "  Bonjour  " });
    expect(v).toEqual({ ok: true, demande: { ...base, titre: "Offre", format: "html", message: "Bonjour" } });
  });
  it("refuse un format inconnu, un contenu trop long, un destinataire vide", () => {
    expect(validerDemande({ ...base, format: "pdf" }).ok).toBe(false);
    expect(validerDemande({ ...base, contenu: "x".repeat(CONTENU_MAX + 1) }).ok).toBe(false);
    expect(validerDemande({ ...base, destinataire: "  " }).ok).toBe(false);
    expect(validerDemande(null).ok).toBe(false);
  });
});

describe("modèle de mail", () => {
  it("salue par le nom quand on n'a pas d'adresse", () => {
    const d = { titre: "Offre", contenu: "x", format: "html" as const, destinataire: "Marie" };
    expect(modeleMail(d, "L").corps).toMatch(/^Bonjour Marie,/);
    expect(modeleMail({ ...d, destinataire: "marie@exemple.fr" }, "L").corps).toMatch(/^Bonjour,/);
    expect(modeleMail({ ...d, message: "Voici notre proposition." }, "L").corps).toMatch(/Voici notre proposition\.\nL/);
  });
});

describe("document de l'artefact", () => {
  it("isole par sandbox, SANS allow-same-origin", () => {
    expect(CSP_ARTEFACT).toMatch(/^sandbox allow-scripts/);
    expect(CSP_ARTEFACT).not.toMatch(/allow-same-origin/);
    expect(CSP_ARTEFACT).toMatch(/frame-ancestors 'self'/);
  });

  it("sert une page complète telle quelle, enveloppe un fragment", () => {
    // La page est servie entière, l'amorce posée en tête, avant tout script de l'artefact.
    expect(documentArtefact(PAGE, "html", "t", (m) => m)).toBe(avecAmorce(PAGE));
    expect(avecAmorce(PAGE).replace(AMORCE_ARTEFACT, "")).toBe(PAGE);
    expect(documentArtefact("<p>Bonjour</p>", "html", "t", (m) => m)).toMatch(/^<!doctype html>[\s\S]*<meta charset="utf-8">[\s\S]*<p>Bonjour<\/p>/);
  });

  it("échappe un texte, et un source React ne peut pas refermer son script", () => {
    expect(documentArtefact("<script>alert(1)</script>", "texte", "t", (m) => m)).toMatch(/&lt;script&gt;/);
    const src = 'const s = "</script><script>alert(1)</script>";';
    expect(chaineJs(src)).not.toMatch(/<\/script/i);
    expect(JSON.parse(chaineJs(src))).toBe(src);
    expect(documentArtefact(src, "react", "t", (m) => m)).not.toMatch(/"<\/script><script>alert/);
  });

  it("pose l'amorce avant le premier script, quelle que soit la forme du document", () => {
    const avant = (doc: string) => doc.indexOf(AMORCE_ARTEFACT) < doc.indexOf("<script>x");
    expect(avant(avecAmorce('<!DOCTYPE html><html><head><title>t</title><script>x</script></head></html>'))).toBe(true);
    expect(avant(avecAmorce("<html><body><script>x</script></body></html>"))).toBe(true);
    expect(avant(avecAmorce("<!doctype html><script>x</script>"))).toBe(true);
    expect(avant(avecAmorce("<script>x</script>"))).toBe(true);
    expect(avecAmorce("<!doctype html><p>a</p>").startsWith("<!doctype html>" + AMORCE_ARTEFACT)).toBe(true);
  });

  it("passe le markdown par le convertisseur fourni", () => {
    expect(documentArtefact("# Titre", "markdown", "t", () => "<h1>Titre</h1>")).toMatch(/<h1>Titre<\/h1>/);
  });
});

it("l'adresse /partage est réservée : aucun gent ne peut la prendre", () => {
  expect(SLUGS_RESERVES.has("partage")).toBe(true);
});

describe("gestion des partages (lot 2)", () => {
  const P = (o: Partial<ResumePartage> = {}): ResumePartage => ({
    jeton: "JETON_MARIE_0123456789abcd",
    titre: "Offre Acme",
    format: "html",
    destinataire: "Marie Dupont",
    caracteres: 10,
    createdAt: "2026-11-12T09:00:00Z",
    expiresAt: "2026-12-12T09:00:00Z",
    revokedAt: null,
    ...o,
  });
  const gestion = (liste: ResumePartage[]) => {
    const revoques: string[] = [];
    return {
      revoques,
      ctx: {
        ...contexte(),
        base: "https://getgents.ai",
        lister: async () => liste,
        revoquer: async (j: string) => {
          const ok = liste.some((p) => p.jeton === j && !p.revokedAt) && !revoques.includes(j);
          if (ok) revoques.push(j);
          return ok;
        },
      },
    };
  };
  const outil = (name: string, args: unknown) => ({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name, arguments: args } });

  it("statut : révoqué l'emporte, puis expiré", () => {
    const maintenant = Date.parse("2026-11-20T00:00:00Z");
    expect(statutPartage(P(), maintenant)).toBe("actif");
    expect(statutPartage(P({ expiresAt: "2026-11-19T00:00:00Z" }), maintenant)).toBe("expire");
    expect(statutPartage(P({ revokedAt: "2026-11-13T00:00:00Z", expiresAt: "2026-11-19T00:00:00Z" }), maintenant)).toBe("revoque");
  });

  it("recherche sans accents ni casse, tous les mots exigés", () => {
    const liste = [P(), P({ jeton: "b".repeat(24), titre: "Étude énergie", destinataire: "paul@exemple.fr" })];
    expect(filtrerPartages(liste, "marie")).toHaveLength(1);
    expect(filtrerPartages(liste, "ETUDE paul")).toHaveLength(1);
    expect(filtrerPartages(liste, "etude marie")).toHaveLength(0);
    expect(filtrerPartages(liste, "  ")).toHaveLength(2);
  });

  it("sans contexte de gestion, un seul outil ; avec, trois — révoquer marqué destructeur", async () => {
    const r = (await traiterMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, gestion([]).ctx)) as {
      result: { tools: { name: string; annotations: { destructiveHint?: boolean } }[] };
    };
    expect(r.result.tools.map((t) => t.name)).toEqual([NOM_OUTIL, OUTIL_LISTER, OUTIL_REVOQUER]);
    expect(r.result.tools[2].annotations.destructiveHint).toBe(true);
  });

  it("liste : identifiant et lien dans le texte, filtrée par la recherche", async () => {
    const { ctx } = gestion([P(), P({ jeton: "c".repeat(24), destinataire: "Paul" })]);
    const r = (await traiterMessage(outil(OUTIL_LISTER, { recherche: "Marie" }), ctx)) as {
      result: { content: { text: string }[]; structuredContent: { partages: { lien: string }[] } };
    };
    expect(r.result.structuredContent.partages).toHaveLength(1);
    expect(r.result.content[0].text).toMatch(/« Offre Acme » → Marie Dupont/);
    expect(r.result.content[0].text).toMatch(/identifiant JETON_MARIE_0123456789abcd/);
    expect(r.result.structuredContent.partages[0].lien).toBe("https://getgents.ai/partage/JETON_MARIE_0123456789abcd");
    const vide = (await traiterMessage(outil(OUTIL_LISTER, { recherche: "Zoé" }), ctx)) as { result: { content: { text: string }[] } };
    expect(vide.result.content[0].text).toMatch(/Aucun partage/);
  });

  it("révoquer : coupe une fois, puis échec lisible ; identifiant requis", async () => {
    const { ctx, revoques } = gestion([P()]);
    const ok = (await traiterMessage(outil(OUTIL_REVOQUER, { identifiant: "JETON_MARIE_0123456789abcd" }), ctx)) as {
      result: { isError?: boolean };
    };
    expect(ok.result.isError).toBeUndefined();
    expect(revoques).toEqual(["JETON_MARIE_0123456789abcd"]);
    const encore = (await traiterMessage(outil(OUTIL_REVOQUER, { identifiant: "JETON_MARIE_0123456789abcd" }), ctx)) as {
      result: { isError: boolean };
    };
    expect(encore.result.isError).toBe(true);
    const sans = (await traiterMessage(outil(OUTIL_REVOQUER, {}), ctx)) as { result: { isError: boolean } };
    expect(sans.result.isError).toBe(true);
  });

  it("un outil de gestion sans contexte reste inconnu", async () => {
    const r = (await traiterMessage(outil(OUTIL_LISTER, {}), contexte())) as { error: { code: number } };
    expect(r.error.code).toBe(-32602);
  });
});

describe("pages (lot A)", () => {
  const PAGE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const outil = (name: string, args: unknown) => ({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } });

  it("valide un repartage : la page et le destinataire suffisent", () => {
    expect(validerDemande({ page: PAGE_ID.toUpperCase(), destinataire: "Paul" })).toEqual({
      ok: true,
      demande: { titre: "", contenu: "", format: "html", destinataire: "Paul", pageId: PAGE_ID },
    });
    expect(validerDemande({ page: "pas-un-id", destinataire: "Paul" }).ok).toBe(false);
    expect(validerDemande({ page: PAGE_ID }).ok).toBe(false);
    // Sans page, le contenu reste exigé.
    expect(validerDemande({ titre: "T", format: "html", destinataire: "Paul" }).ok).toBe(false);
  });

  it("repartage : aucun contrôle de fidélité, titre du mail pris sur la page", async () => {
    const recus: { d: DemandePartage; f: unknown }[] = [];
    const r = (await traiterMessage(outil(NOM_OUTIL, { page: PAGE_ID, destinataire: "Paul" }), {
      enregistrer: async (d, f) => {
        recus.push({ d, f });
        return { lien: "https://getgents.ai/partage/X", pageId: PAGE_ID, titre: "Offre Acme", assistant: true };
      },
    })) as { result: { content: { text: string }[]; structuredContent: { objet: string; page: string; fidelite: unknown } } };
    expect(recus[0].f).toBeNull();
    expect(r.result.structuredContent).toMatchObject({ objet: "Offre Acme", page: PAGE_ID, fidelite: null });
    expect(r.result.content[0].text).toMatch(/aucun contenu recopié/);
    expect(r.result.content[0].text).toMatch(/Assistant du document ACTIVÉ/);
  });

  it("nouveau partage : l'identifiant de page est rendu au modèle pour la suite", async () => {
    const r = (await traiterMessage(outil(NOM_OUTIL, { titre: "Offre", contenu: PAGE, format: "html", destinataire: "Marie" }), {
      enregistrer: async () => ({ lien: "https://getgents.ai/partage/Y", pageId: PAGE_ID, nouvellePage: true, titre: "Offre" }),
    })) as { result: { content: { text: string }[] } };
    expect(r.result.content[0].text).toMatch(new RegExp(`Nouvelle page créée.*${PAGE_ID}`));
    expect(r.result.content[0].text).toMatch(/aucune trace de troncature/);
  });

  it("une page inconnue du compte est un échec lisible", async () => {
    const r = (await traiterMessage(outil(NOM_OUTIL, { page: PAGE_ID, destinataire: "Paul" }), { enregistrer: async () => null })) as {
      result: { isError: boolean; content: { text: string }[] };
    };
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toMatch(/Aucune page/);
  });

  it("mettre à jour : contrôle avec le format de la page, et dit combien de liens changent", async () => {
    const appels: unknown[] = [];
    const ctx = {
      enregistrer: async () => null,
      mettreAJour: async (id: string, d: unknown) => {
        appels.push([id, d]);
        return { version: 3, liens: 2, format: "react" as const };
      },
    };
    const liste = (await traiterMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx)) as { result: { tools: { name: string }[] } };
    expect(liste.result.tools.map((t) => t.name)).toContain(OUTIL_METTRE_A_JOUR);
    const r = (await traiterMessage(outil(OUTIL_METTRE_A_JOUR, { page: PAGE_ID, contenu: "export default function App() {\n  return <div>o" }), ctx)) as {
      result: { content: { text: string }[]; structuredContent: { version: number } };
    };
    expect(appels[0]).toEqual([PAGE_ID, { contenu: "export default function App() {\n  return <div>o", titre: undefined, format: undefined }]);
    expect(r.result.structuredContent.version).toBe(3);
    expect(r.result.content[0].text).toMatch(/version 3.*2 lien/);
    // Format React de la page : la fin manquante est repérée.
    expect(r.result.content[0].text).toMatch(/ABSENTE/);
    const vide = (await traiterMessage(outil(OUTIL_METTRE_A_JOUR, { page: PAGE_ID, contenu: " " }), ctx)) as { result: { isError: boolean } };
    expect(vide.result.isError).toBe(true);
  });

  it("la liste donne l'identifiant de page de chaque partage", () => {
    const t = texteListe(
      [{ jeton: "J".repeat(24), titre: "Offre", format: "html", destinataire: "Marie", caracteres: 1, createdAt: "2026-11-12T09:00:00Z", expiresAt: null, revokedAt: null, pageId: PAGE_ID }],
      "https://getgents.ai"
    );
    expect(t).toMatch(new RegExp(`page ${PAGE_ID}`));
  });
});

describe("vocabulaire « page » (12/11)", () => {
  it("annonce partager_page, accepte encore partager_artefact (listes d'outils gardées par Claude)", async () => {
    const liste = (await traiterMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, contexte())) as {
      result: { tools: { name: string; title: string; description: string }[] };
    };
    expect(liste.result.tools[0].name).toBe("partager_page");
    expect(liste.result.tools[0].title).toBe("Partager une page avec un client");
    // Les synonymes restent : c'est par eux que le modèle reconnaît la demande.
    expect(liste.result.tools[0].description).toMatch(/artefact/);
    expect(liste.result.tools[0].description).toMatch(/canvas/);
    const ancien = (await traiterMessage(
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "partager_artefact", arguments: { titre: "Offre", contenu: PAGE, format: "html", destinataire: "Marie" } } },
      contexte()
    )) as { result: { isError?: boolean } };
    expect(ancien.result.isError).toBeUndefined();
  });
});
