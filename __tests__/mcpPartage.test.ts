import {
  controleFidelite,
  modeleMail,
  traiterMessage,
  validerDemande,
  CONTENU_MAX,
  NOM_OUTIL,
  type ContexteMcp,
  type DemandePartage,
} from "@/lib/mcpPartage";
import { chaineJs, CSP_ARTEFACT, documentArtefact } from "@/lib/documentArtefact";
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

  it("liste UN outil, au schéma exigeant le contenu complet", async () => {
    const r = (await traiterMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, contexte())) as {
      result: { tools: { name: string; description: string; inputSchema: { required: string[] } }[] };
    };
    expect(r.result.tools).toHaveLength(1);
    expect(r.result.tools[0].name).toBe(NOM_OUTIL);
    expect(r.result.tools[0].inputSchema.required).toEqual(["titre", "contenu", "format", "destinataire"]);
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
    expect(documentArtefact(PAGE, "html", "t", (m) => m)).toBe(PAGE);
    expect(documentArtefact("<p>Bonjour</p>", "html", "t", (m) => m)).toMatch(/^<!doctype html>[\s\S]*<meta charset="utf-8">[\s\S]*<p>Bonjour<\/p>/);
  });

  it("échappe un texte, et un source React ne peut pas refermer son script", () => {
    expect(documentArtefact("<script>alert(1)</script>", "texte", "t", (m) => m)).toMatch(/&lt;script&gt;/);
    const src = 'const s = "</script><script>alert(1)</script>";';
    expect(chaineJs(src)).not.toMatch(/<\/script/i);
    expect(JSON.parse(chaineJs(src))).toBe(src);
    expect(documentArtefact(src, "react", "t", (m) => m)).not.toMatch(/"<\/script><script>alert/);
  });

  it("passe le markdown par le convertisseur fourni", () => {
    expect(documentArtefact("# Titre", "markdown", "t", () => "<h1>Titre</h1>")).toMatch(/<h1>Titre<\/h1>/);
  });
});

it("l'adresse /partage est réservée : aucun gent ne peut la prendre", () => {
  expect(SLUGS_RESERVES.has("partage")).toBe(true);
});
