// Recopie le worker pdf.js de la version INSTALLÉE vers public/pdfjs/.
//
// pdf.js refuse tout écart de version entre l'API (bundle Next) et son worker
// (« The API version X does not match the Worker version Y ») : la lecture
// de chaque PDF échoue alors silencieusement et les documents de la base de
// connaissance sont enregistrés « contenu non lu ». C'est arrivé quand une
// mise à jour de dépendances a bougé pdfjs-dist sans toucher au fichier
// vendorisé. Lancé avant chaque build (`prebuild`) ; le fichier reste suivi
// par git pour que `next dev` fonctionne sans étape supplémentaire.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const targetDir = join(root, "public", "pdfjs");
const target = join(targetDir, "pdf.worker.min.mjs");

const { version } = JSON.parse(readFileSync(join(root, "node_modules", "pdfjs-dist", "package.json"), "utf8"));
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log(`[pdfjs] worker ${version} recopié dans public/pdfjs/`);
