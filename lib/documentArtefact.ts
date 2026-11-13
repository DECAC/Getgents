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
export function cspArtefact(ancetres = "'self'"): string {
  return [
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
    `frame-ancestors ${ancetres}`,
  ].join("; ");
}

/**
 * Servi par getgents.ai : seule l'application peut l'encadrer. Sur le domaine
 * de contenu, `frame-ancestors` nomme l'origine qui a signé l'adresse
 * (`cspArtefact(origine)`) : `'self'` y désignerait le domaine de contenu.
 */
export const CSP_ARTEFACT = cspArtefact();

export function echapperHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Une chaîne JS sûre dans un <script> : `</script>` ne peut pas la refermer. */
export function chaineJs(s: string): string {
  return JSON.stringify(s).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const TETE = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';

/**
 * Script posé AVANT tout code de l'artefact. Vécu (premier essai réel,
 * 12/11) : « le rendu est bon, mais aucune donnée ne s'affiche » — la page
 * se dessinait, son script s'arrêtait. Dans un cadre `sandbox` sans
 * `allow-same-origin`, toucher `localStorage` lève une erreur, et un artefact
 * Claude peut appeler `window.storage`, qui n'existe que dans Claude. Les
 * deux sont remplacés par une mémoire de la page : l'artefact tourne, ses
 * données vivent le temps de la visite (rien n'est gardé ni partagé).
 *
 * Toute erreur restante s'affiche dans un bandeau discret au lieu de laisser
 * une page muette : c'est le témoin de l'essai.
 *
 * Profondeur de lecture (13/11) : le document dit à la page Getgents jusqu'où
 * il a défilé (en %, par paliers de 5), y compris dans une zone intérieure
 * qui défile. Un nombre, rien d'autre ; la page ne l'écoute que de SON cadre
 * et ne le garde que si le visiteur a accepté de partager ses données.
 */
export const AMORCE_ARTEFACT = `<script>(function(){
function memoire(){var d=Object.create(null);return{getItem:function(k){k=String(k);return k in d?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d=Object.create(null)},key:function(i){var c=Object.keys(d);return i<c.length?c[i]:null},get length(){return Object.keys(d).length}}}
["localStorage","sessionStorage"].forEach(function(n){var ok=false;try{ok=!!window[n];window[n].getItem("__");}catch(e){ok=false}if(!ok){try{Object.defineProperty(window,n,{value:memoire(),configurable:true})}catch(e){}}});
if(!window.storage){var s=Object.create(null);window.storage={
get:function(k){k=String(k);return Promise.resolve(k in s?{key:k,value:s[k],shared:false}:null)},
set:function(k,v){s[String(k)]=v;return Promise.resolve({key:String(k),value:v,shared:false})},
delete:function(k){delete s[String(k)];return Promise.resolve({key:String(k),deleted:true,shared:false})},
list:function(p){p=p?String(p):"";return Promise.resolve({keys:Object.keys(s).filter(function(k){return k.indexOf(p)===0}),prefix:p,shared:false})}};}
var vues=0;function signaler(m){if(vues++>2)return;function poser(){var b=document.createElement("div");b.setAttribute("data-getgents-erreur","");b.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;padding:8px 12px;border-radius:8px;background:#fff4f2;color:#7a1c12;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.15)";b.textContent="Erreur dans l'artefact : "+m;(document.body||document.documentElement).appendChild(b)}document.body?poser():document.addEventListener("DOMContentLoaded",poser)}
var pmax=-1;function mesurer(e,force){try{var t=e&&e.target&&e.target!==document&&e.target.scrollHeight?e.target:document.scrollingElement||document.documentElement;var h=t.scrollHeight,v=t===document.scrollingElement||t===document.documentElement?window.innerHeight:t.clientHeight;if(!h)return;var p=Math.min(100,Math.round((t.scrollTop+v)/h*100));if(p>pmax+4||(p===100&&pmax<100)||force){pmax=Math.max(pmax,p);parent.postMessage({getgents:"profondeur",v:pmax},"*")}}catch(x){}}
window.addEventListener("message",function(e){if(e.source===parent&&e.data&&e.data.getgents==="profondeur?")mesurer(null,true)});
var minuteur=0;document.addEventListener("scroll",function(e){if(minuteur)return;minuteur=setTimeout(function(){minuteur=0;mesurer(e)},400)},true);window.addEventListener("load",function(){mesurer(null)});
window.addEventListener("error",function(e){signaler(e.message||"ressource introuvable")});
window.addEventListener("unhandledrejection",function(e){var r=e.reason;signaler(r&&r.message?r.message:String(r))});
})();</script>`;

/** Pose l'amorce en tête du document, avant tout script de l'artefact. */
export function avecAmorce(html: string): string {
  const tete = html.match(/<head[^>]*>/i);
  if (tete && tete.index !== undefined) {
    const i = tete.index + tete[0].length;
    return html.slice(0, i) + AMORCE_ARTEFACT + html.slice(i);
  }
  const racine = html.match(/<html[^>]*>/i);
  if (racine && racine.index !== undefined) {
    const i = racine.index + racine[0].length;
    return html.slice(0, i) + `<head>${AMORCE_ARTEFACT}</head>` + html.slice(i);
  }
  // Doctype seul, ou rien : l'amorce passe juste après le doctype.
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctype) return doctype[0] + AMORCE_ARTEFACT + html.slice(doctype[0].length);
  return AMORCE_ARTEFACT + html;
}
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
  return avecAmorce(documentBrut(contenu, format, titre, versHtml));
}

function documentBrut(contenu: string, format: FormatArtefact, titre: string, versHtml: (md: string) => string): string {
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
