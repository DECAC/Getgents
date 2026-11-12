/**
 * Le document HTML qui affiche un artefact partagé, selon son format.
 * Module PUR (testable). Le résultat est servi sous une CSP `sandbox` :
 * origine opaque, aucun accès aux cookies ni aux pages de Getgents. Le code
 * de l'artefact peut donc s'exécuter : il ne peut rien atteindre d'autre que
 * lui-même (`CSP_ARTEFACT`).
 */

import type { FormatArtefact } from "./mcpPartage";

/**
 * La politique du document de l'artefact. `sandbox` SANS `allow-same-origin` :
 * c'est la ligne qui fait l'isolement. Le reste est large exprès — un
 * artefact charge ses bibliothèques depuis un CDN, ses polices, ses images.
 */
export const CSP_ARTEFACT = [
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads",
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https: blob:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "connect-src https:",
  "media-src data: blob: https:",
  "frame-src https:",
  "form-action https:",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join("; ");

export function echapperHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Une chaîne JS sûre dans un <script> : `</script>` ne peut pas la refermer. */
export function chaineJs(s: string): string {
  return JSON.stringify(s).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const TETE = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
const STYLE_LECTURE =
  "<style>body{font:16px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f1b1c;max-width:820px;margin:0 auto;padding:32px 20px}" +
  "pre{white-space:pre-wrap;word-break:break-word;background:#f6f3ef;padding:16px;border-radius:8px;font-size:13px}" +
  "img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px}</style>";

/**
 * Composant React (format des artefacts Claude) : converti par Babel DANS le
 * navigateur, bibliothèques courantes servies par esm.sh, Tailwind par son
 * CDN. Au mieux : un import inconnu ou une syntaxe exotique échoue, et l'on
 * montre alors l'erreur et le code source plutôt qu'une page blanche.
 */
function documentReact(source: string, titre: string): string {
  const imports = {
    react: "https://esm.sh/react@18.3.1",
    "react/": "https://esm.sh/react@18.3.1/",
    "react-dom": "https://esm.sh/react-dom@18.3.1?deps=react@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1",
    "lucide-react": "https://esm.sh/lucide-react@0.460.0?deps=react@18.3.1",
    recharts: "https://esm.sh/recharts@2.13.3?deps=react@18.3.1,react-dom@18.3.1",
  };
  return `<!doctype html><html lang="fr"><head>${TETE}<title>${echapperHtml(titre)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
<script type="importmap">${JSON.stringify({ imports }).replace(/</g, "\\u003c")}</script>
</head><body><div id="root"></div>
<script type="module">
const source = ${chaineJs(source)};
function echec(e) {
  const p = document.createElement("pre");
  p.style.cssText = "white-space:pre-wrap;font:13px monospace;padding:16px;background:#fff4f2;color:#7a1c12";
  p.textContent = "Cet artefact React n'a pas pu être affiché (" + (e && e.message ? e.message : e) + ").\\n\\nCode reçu :\\n\\n" + source;
  document.body.replaceChildren(p);
}
try {
  const code = Babel.transform(source, {
    filename: "artefact.tsx",
    presets: [["react", { runtime: "automatic" }], "typescript"],
  }).code;
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  const [mod, React, { createRoot }] = await Promise.all([import(url), import("react"), import("react-dom/client")]);
  const App = mod.default ?? Object.values(mod).find((v) => typeof v === "function");
  if (!App) throw new Error("aucun composant exporté");
  createRoot(document.getElementById("root")).render(React.createElement(App));
} catch (e) { echec(e); }
</script></body></html>`;
}

export function documentArtefact(contenu: string, format: FormatArtefact, titre: string, versHtml: (md: string) => string): string {
  switch (format) {
    case "html":
      // Un fragment (sans <html>) reçoit l'en-tête minimal : encodage et largeur d'écran.
      return /<html[\s>]|<!doctype/i.test(contenu) ? contenu : `<!doctype html><html lang="fr"><head>${TETE}</head><body>${contenu}</body></html>`;
    case "svg":
      return `<!doctype html><html><head>${TETE}<style>html,body{margin:0;height:100%;display:grid;place-items:center}svg{max-width:100%;max-height:100vh}</style></head><body>${contenu}</body></html>`;
    case "markdown":
      return `<!doctype html><html lang="fr"><head>${TETE}<title>${echapperHtml(titre)}</title>${STYLE_LECTURE}</head><body>${versHtml(contenu)}</body></html>`;
    case "react":
      return documentReact(contenu, titre);
    default:
      return `<!doctype html><html lang="fr"><head>${TETE}${STYLE_LECTURE}</head><body><pre>${echapperHtml(contenu)}</pre></body></html>`;
  }
}
