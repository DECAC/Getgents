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
 * Claude peut appeler `window.storage`, qui n'existe que dans Claude.
 * `localStorage` est remplacé par une mémoire de la page. `window.storage`
 * (23/11) passe par la PAGE PARENTE quand elle sait le servir — poignée de
 * main `stockage?` / `stockage!`, puis un message par opération
 * (`useStockagePartage`) : `shared` vrai = stockage de la page chez Getgents,
 * commun à tous ses lecteurs (votes) ; faux = données du lecteur, gardées
 * dans le navigateur de la page parente. Sans réponse en 1,5 s (vignette,
 * brouillon collé), mémoire de la page comme avant.
 *
 * Toute erreur restante s'affiche dans un bandeau discret au lieu de laisser
 * une page muette : c'est le témoin de l'essai.
 *
 * Signal « prêt » (16/11) : posté au tout premier script, il dit à la page
 * que le cadre affiche bien NOTRE document — sans lui, la page recharge
 * depuis getgents.ai (`useCadreAvecRepli`, domaine de contenu bloqué).
 *
 * Profondeur de lecture (13/11) : le document dit à la page Getgents jusqu'où
 * il a défilé (en %, par paliers de 5), y compris dans une zone intérieure
 * qui défile. Un nombre, rien d'autre ; la page ne l'écoute que de SON cadre
 * et ne le garde que si le visiteur a accepté de partager ses données.
 *
 * Choix du lecteur (19/11) : à la demande de la page (`choix?`), le document
 * relève les cases cochées, radios choisis, listes, curseurs, nombres et
 * `<output>`, avec un libellé lisible — JAMAIS un champ de saisie libre. Rien
 * ne part sans le clic du lecteur sur le bouton d'engagement, qui VOIT la liste
 * et peut en retirer chaque ligne ; le serveur revalide tout (`choixValides`).
 */
export const AMORCE_ARTEFACT = `<script>(function(){
try{parent.postMessage({getgents:"pret"},"*")}catch(e){}
function memoire(){var d=Object.create(null);return{getItem:function(k){k=String(k);return k in d?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d=Object.create(null)},key:function(i){var c=Object.keys(d);return i<c.length?c[i]:null},get length(){return Object.keys(d).length}}}
["localStorage","sessionStorage"].forEach(function(n){var ok=false;try{ok=!!window[n];window[n].getItem("__");}catch(e){ok=false}if(!ok){try{Object.defineProperty(window,n,{value:memoire(),configurable:true})}catch(e){}}});
if(!window.storage){(function(){
var mem={p:Object.create(null),s:Object.create(null)},relais=null,file=[],attente=Object.create(null),seq=0;
function local(o,k,v,pre,sh){var d=sh?mem.s:mem.p;if(o==="get")return k in d?{key:k,value:d[k],shared:sh}:null;if(o==="set"){d[k]=v;return{key:k,value:v,shared:sh}}if(o==="delete"){delete d[k];return{key:k,deleted:true,shared:sh}}return{keys:Object.keys(d).filter(function(c){return c.indexOf(pre)===0}),prefix:pre,shared:sh}}
function envoyer(o,k,v,pre,sh,ok,ko){var id="s"+(++seq);attente[id]={ok:ok,ko:ko};try{parent.postMessage({getgents:"stockage",id:id,op:o,cle:k,valeur:v,prefixe:pre,partage:sh},"*")}catch(e){delete attente[id];ko(e);return}setTimeout(function(){if(attente[id]){delete attente[id];ko(new Error("stockage de la page indisponible (délai dépassé)"))}},15000)}
function op(o,k,v,pre,sh){k=k==null?"":String(k);pre=pre==null?"":String(pre);sh=sh===true;if(o==="set"&&typeof v!=="string")v=JSON.stringify(v);return new Promise(function(ok,ko){if(relais===false)return ok(local(o,k,v,pre,sh));if(relais===true)return envoyer(o,k,v,pre,sh,ok,ko);file.push(function(){relais?envoyer(o,k,v,pre,sh,ok,ko):ok(local(o,k,v,pre,sh))})})}
function decider(r){if(relais!==null)return;relais=r;var f=file;file=[];f.forEach(function(x){x()})}
window.addEventListener("message",function(e){if(e.source!==parent||!e.data)return;var d=e.data;if(d.getgents==="stockage!")decider(true);else if(d.getgents==="stockage:reponse"&&attente[d.id]){var a=attente[d.id];delete attente[d.id];d.ok?a.ok(d.resultat===undefined?null:d.resultat):a.ko(new Error(d.erreur||"stockage refusé"))}});
try{parent.postMessage({getgents:"stockage?"},"*")}catch(e){}setTimeout(function(){decider(false)},1500);
window.storage={get:function(k,sh){return op("get",k,null,"",sh)},set:function(k,v,sh){return op("set",k,v,"",sh)},delete:function(k,sh){return op("delete",k,null,"",sh)},list:function(p,sh){return op("list",null,null,p,sh)}};
})();}
var vues=0;function signaler(m){if(vues++>2)return;function poser(){var b=document.createElement("div");b.setAttribute("data-getgents-erreur","");b.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;padding:8px 12px;border-radius:8px;background:#fff4f2;color:#7a1c12;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.15)";b.textContent="Erreur dans l'artefact : "+m;(document.body||document.documentElement).appendChild(b)}document.body?poser():document.addEventListener("DOMContentLoaded",poser)}
var pmax=-1;function mesurer(e,force){try{var t=e&&e.target&&e.target!==document&&e.target.scrollHeight?e.target:document.scrollingElement||document.documentElement;var h=t.scrollHeight,v=t===document.scrollingElement||t===document.documentElement?window.innerHeight:t.clientHeight;if(!h)return;var p=Math.min(100,Math.round((t.scrollTop+v)/h*100));if(p>pmax+4||(p===100&&pmax<100)||force){pmax=Math.max(pmax,p);parent.postMessage({getgents:"profondeur",v:pmax},"*")}}catch(x){}}
window.addEventListener("message",function(e){if(e.source===parent&&e.data&&e.data.getgents==="profondeur?")mesurer(null,true)});
var minuteur=0;document.addEventListener("scroll",function(e){if(minuteur)return;minuteur=setTimeout(function(){minuteur=0;mesurer(e)},400)},true);window.addEventListener("load",function(){mesurer(null)});
function propre(t){return String(t||"").replace(/\\s+/g," ").trim()}
function ligne1(n){if(!n)return"";var acc="";function marcher(x){for(var c=x.firstChild;c;c=c.nextSibling){if(c.nodeType===3){acc+=c.nodeValue}else if(c.nodeType===1){if(/^(SCRIPT|STYLE|INPUT|SELECT|TEXTAREA|BUTTON)$/.test(c.tagName))continue;var d="";try{d=getComputedStyle(c).display}catch(x){}if(d==="none")continue;var bloc=d.indexOf("inline")!==0&&d!=="contents";if(bloc&&propre(acc))return true;if(marcher(c))return true;if(bloc&&propre(acc))return true}}return false}marcher(n);return propre(acc)}
function titreAvant(el){var hs=document.querySelectorAll("h1,h2,h3,h4,h5,h6"),r="";for(var i=0;i<hs.length;i++){if(hs[i].compareDocumentPosition(el)&4)r=ligne1(hs[i]);else break}return r}
function nomDe(el){var l=el.labels&&el.labels[0];return ligne1(l)||propre(el.getAttribute("aria-label")||el.getAttribute("title"))}
function groupeDe(el,coche){if(coche){var f=el.closest("fieldset");var lg=f&&f.querySelector("legend");if(lg)return ligne1(lg);var g=el.closest("[role=radiogroup],[role=group]");if(g&&g.getAttribute("aria-label"))return propre(g.getAttribute("aria-label"));var lb=g&&g.getAttribute("aria-labelledby");if(lb){var n=document.getElementById(lb);if(n)return ligne1(n)}return titreAvant(el)}return nomDe(el)||titreAvant(el)}
function releverChoix(){var r=[];try{var els=document.querySelectorAll("input,select,output");for(var i=0;i<els.length&&r.length<20;i++){var el=els[i];if(el.disabled||el.closest("[hidden],[data-getgents-ignorer]"))continue;var t=(el.type||"").toLowerCase(),tag=el.tagName;
if(tag==="INPUT"&&(t==="radio"||t==="checkbox")){if(!el.checked)continue;r.push({groupe:groupeDe(el,true),valeur:nomDe(el)||propre(el.value),modifie:el.checked!==el.defaultChecked})}
else if(tag==="INPUT"&&(t==="range"||t==="number")){r.push({groupe:groupeDe(el,false),valeur:propre(el.value),modifie:el.value!==el.defaultValue})}
else if(tag==="SELECT"){var o=el.options[el.selectedIndex];if(!o)continue;r.push({groupe:groupeDe(el,false),valeur:propre(o.text),modifie:!o.defaultSelected})}
else if(tag==="OUTPUT"){r.push({groupe:groupeDe(el,false),valeur:propre(el.value||el.textContent),modifie:el.value!==el.defaultValue})}}}catch(x){}return r}
window.addEventListener("message",function(e){if(e.source===parent&&e.data&&e.data.getgents==="choix?")try{parent.postMessage({getgents:"choix",v:releverChoix()},"*")}catch(x){}});
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
