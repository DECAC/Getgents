import type { Browser } from "puppeteer-core";
import { adresseAutorisee, DELAI_CAPTURE_MS, DELAI_RESEAU_MS, HAUTEUR_CAPTURE, LARGEUR_CAPTURE } from "@/lib/apercuCapture";

/**
 * Capture d'une page dans un vrai Chromium, côté serveur (aperçu du lien).
 *
 * Sur Vercel : `@sparticuz/chromium` (binaire compressé dans le paquet,
 * extrait dans /tmp au premier appel). En local : `CHROMIUM_CAPTURE`, sinon le
 * Chromium de Playwright installé dans l'environnement de l'agent.
 *
 * Le document est servi au navigateur sous la même CSP `sandbox` que chez un
 * lecteur (origine opaque) ; toute autre requête passe par `adresseAutorisee`.
 */

const ORIGINE_CAPTURE = "https://capture.getgents.invalid/";

async function lancer(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: { width: LARGEUR_CAPTURE, height: HAUTEUR_CAPTURE },
    });
  }
  return puppeteer.launch({
    executablePath: process.env.CHROMIUM_CAPTURE ?? "/opt/pw-browsers/chromium",
    args: ["--no-sandbox", "--headless=new"],
    headless: true,
    defaultViewport: { width: LARGEUR_CAPTURE, height: HAUTEUR_CAPTURE },
  });
}

export type ResultatCapture = { ok: true; png: Buffer } | { ok: false; raison: "vide" | "delai" | "erreur"; detail?: string };

/** Capture le haut de la page (1200 × 630). Ne lève jamais. */
export async function capturerDocument(html: string, cspDocument: string): Promise<ResultatCapture> {
  let navigateur: Browser | null = null;
  const minuterie = new Promise<ResultatCapture>((r) => setTimeout(() => r({ ok: false, raison: "delai" }), DELAI_CAPTURE_MS));
  const travail = (async (): Promise<ResultatCapture> => {
    navigateur = await lancer();
    const page = await navigateur.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url === ORIGINE_CAPTURE)
        return void req.respond({ status: 200, contentType: "text/html; charset=utf-8", headers: { "Content-Security-Policy": cspDocument }, body: html });
      if (adresseAutorisee(url)) return void req.continue();
      return void req.abort("blockedbyclient");
    });
    await page.goto(ORIGINE_CAPTURE, { waitUntil: "load", timeout: DELAI_CAPTURE_MS - 4_000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: DELAI_RESEAU_MS }).catch(() => undefined);
    // Une page qui n'a rien dessiné (React en échec, script bloqué) : pas d'aperçu plutôt qu'une carte blanche.
    const visible = await page.evaluate(() => {
      const b = document.body;
      if (!b) return false;
      if ((b.innerText || "").trim().length > 0) return true;
      return !!b.querySelector("img, svg, canvas, video, picture");
    });
    if (!visible) return { ok: false, raison: "vide" };
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: LARGEUR_CAPTURE, height: HAUTEUR_CAPTURE } });
    return { ok: true, png: Buffer.from(png) };
  })().catch((e: Error) => ({ ok: false as const, raison: "erreur" as const, detail: e.message.slice(0, 200) }));
  // Le navigateur est fermé quand le TRAVAIL finit — même s'il finit après la minuterie (sinon il resterait ouvert).
  const fermer = travail.finally(async () => {
    const n = navigateur as Browser | null;
    if (n) await n.close().catch(() => undefined);
  });
  const r = await Promise.race([travail, minuterie]);
  if (r.ok || r.raison !== "delai") await fermer;
  return r;
}
