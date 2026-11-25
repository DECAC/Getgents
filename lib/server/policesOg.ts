import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Polices des vignettes (`next/og`) : Bricolage Grotesque (OFL), embarquée par
 * `outputFileTracingIncludes` (next.config.mjs) dans CHAQUE route qui en dessine.
 * Absente : undefined, la vignette part avec la police par défaut.
 */
const POLICES = join(process.cwd(), "lib/og/polices");

export async function policesOg() {
  try {
    const [gras, normal] = await Promise.all([
      readFile(join(POLICES, "BricolageGrotesque-Bold.ttf")),
      readFile(join(POLICES, "BricolageGrotesque-Regular.ttf")),
    ]);
    return [
      { name: "B", data: gras, weight: 700 as const, style: "normal" as const },
      { name: "B", data: normal, weight: 400 as const, style: "normal" as const },
    ];
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:partage", event: "vignette_sans_polices", detail: (e as Error).message }));
    return undefined;
  }
}
