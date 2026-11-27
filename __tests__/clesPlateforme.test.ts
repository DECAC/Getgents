import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Une seule porte par clé de la plateforme (Publiciste, lot 3) : Gemini et
 * Mistral ne passent pas par OpenRouter et sont TOUJOURS payés par la
 * plateforme. Une lecture dispersée ferait un chemin de facturation sans garde.
 */
function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const c = join(dir, e);
    if (statSync(c).isDirectory()) fichiers(c, acc);
    else if (/\.tsx?$/.test(e)) acc.push(c);
  }
  return acc;
}
const tous = ["app", "lib", "components"].flatMap((r) => fichiers(r));

describe.each([
  ["GEMINI_API_KEY", "lib/server/gemini.ts"],
  ["MISTRAL_API_KEY", "lib/server/mistral.ts"],
])("clé %s", (cle, seul) => {
  it(`n'est lue que par ${seul}`, () => {
    expect(tous.filter((f) => readFileSync(f, "utf8").includes(cle)).filter((f) => f !== seul)).toEqual([]);
  });
});

describe("enveloppe WAV", () => {
  it("pose un en-tête de 44 octets cohérent", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pcmEnWav } = require("@/lib/server/gemini");
    const w: Uint8Array = pcmEnWav(new Uint8Array(4800), 24000);
    expect(w.length).toBe(44 + 4800);
    expect(Buffer.from(w.slice(0, 4)).toString()).toBe("RIFF");
    expect(new DataView(w.buffer).getUint32(24, true)).toBe(24000);
    expect(new DataView(w.buffer).getUint32(40, true)).toBe(4800);
  });
});
