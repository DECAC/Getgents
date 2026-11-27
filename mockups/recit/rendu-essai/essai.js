// Usage : node essai.js <A|B|C|son> <v|c|h> [sortie]
const { chromium } = require("playwright"); const { spawn } = require("child_process"); const fs = require("fs");
const [mode, fmt, sortie] = process.argv.slice(2);
const TAILLES = { v: [1080, 1920], c: [1080, 1080], h: [1920, 1080] }; const [W, H] = TAILLES[fmt] || [0, 0];
const FPS = 30, DEBIT = 8e6;
(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ acceptDownloads: true }); p.on("pageerror", (e) => console.error("ERR", e.message));
  await p.goto("http://localhost:8766/film.html"); await p.waitForFunction(() => window.pret, null, { timeout: 60000 });
  const t0 = Date.now(); let info = {};
  const recup = async (fn) => { const [d] = await Promise.all([p.waitForEvent("download", { timeout: 600000 }), fn()]); await d.saveAs(sortie); };
  if (mode === "son") await recup(() => p.evaluate(() => window.sonWav()));
  if (mode === "B") await recup(async () => { info = await p.evaluate(([W, H, d]) => window.tempsReel(W, H, d), [W, H, DEBIT]); });
  if (mode === "C") await recup(async () => { info = await p.evaluate(([W, H, f, d]) => window.webCodecs(W, H, f, d), [W, H, FPS, DEBIT]); });
  if (mode === "A") {
    await p.evaluate(([W, H]) => window.preparer(W, H), [W, H]);
    const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-i", "son.wav",
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", sortie]);
    const n = 72 * FPS; let tDessin = 0;
    for (let i = 0; i < n; i++) {
      const a = Date.now(); const url = await p.evaluate(([t, W, H]) => window.imageJpeg(t, W, H, 0.95), [i / FPS, W, H]); tDessin += Date.now() - a;
      const buf = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
      if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once("drain", ok));
    }
    ff.stdin.end(); await new Promise((ok) => ff.on("close", ok));
    info = { msParImage: +(tDessin / n).toFixed(1) };
  }
  console.log(JSON.stringify({ mode, fmt, secondes: +((Date.now() - t0) / 1000).toFixed(1), ...info }));
  await b.close();
})();
