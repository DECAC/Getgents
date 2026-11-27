/**
 * Moteur de l'atelier du film (Publiciste, lot 1) : dessin d'une image du
 * film à l'instant t, mixage du son, et fabrication du MP4 DANS LE NAVIGATEUR
 * (WebCodecs + mp4-muxer). Choix tranché à l'essai du 27/11
 * (mockups/recit/rendu-essai/) : 2 à 4 fois plus rapide que la durée du film,
 * même qualité qu'un rendu serveur, aucun plafond de 300 s. Vérifié par
 * l'éditeur : H.264 et AAC disponibles sur son Mac et son iPhone.
 *
 * Le même `dessinerImage` sert à l'aperçu et au fichier : ce qu'on voit est
 * ce qu'on obtient.
 */
import type { SceneFilm } from "@/lib/publiciste";
import {
  DEBIT_AUDIO,
  DEBIT_VIDEO,
  FPS,
  GAIN_VOIX,
  TAUX_AUDIO,
  lignesSousTitre,
  opaciteEntree,
  paliersMusique,
  sceneA,
  sousTitreA,
  type Calendrier,
} from "@/lib/filmRendu";

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Toile = HTMLCanvasElement | OffscreenCanvas;

/** Une image de scène et son fond flou, préparé une fois (le flou par image coûte cher). */
export interface ImageScene {
  image: ImageBitmap;
  fond: HTMLCanvasElement | OffscreenCanvas;
}

function toile(l: number, h: number): Toile {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(l, h);
  const c = document.createElement("canvas");
  c.width = l;
  c.height = h;
  return c;
}

/**
 * Prépare une image importée. Le fond flou est obtenu en la réduisant à
 * 27×48 puis en l'agrandissant au dessin : pas de `ctx.filter`, absent des
 * Safari anciens.
 */
export async function preparerImage(fichier: Blob): Promise<ImageScene> {
  const image = await createImageBitmap(fichier);
  const fond = toile(27, 48);
  const g = fond.getContext("2d") as Ctx2D;
  const s = Math.max(27 / image.width, 48 / image.height);
  g.drawImage(image, (27 - image.width * s) / 2, (48 - image.height * s) / 2, image.width * s, image.height * s);
  g.fillStyle = "rgba(0,0,0,.45)";
  g.fillRect(0, 0, 27, 48);
  return { image, fond };
}

/** Teinte stable par scène, pour les cartes sans image. */
const TEINTES = ["#2b2f45", "#3a2c2c", "#26392f", "#3b3424", "#2d2a3e", "#342c38"];

function couvrir(g: Ctx2D, src: CanvasImageSource & { width: number; height: number }, W: number, H: number) {
  const s = Math.max(W / src.width, H / src.height);
  g.drawImage(src, (W - src.width * s) / 2, (H - src.height * s) / 2, src.width * s, src.height * s);
}

function texteCentre(g: Ctx2D, texte: string, W: number, y: number, taille: number, couleur: string, poids = 400) {
  g.font = `${poids} ${taille}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillStyle = couleur;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  lignesSousTitre(texte, W * 0.8, (x) => g.measureText(x).width).forEach((l, k) => g.fillText(l, W / 2, y + k * taille * 1.3));
}

function dessinerScene(g: Ctx2D, scene: SceneFilm, index: number, img: ImageScene | null, alpha: number, zoom: number, W: number, H: number) {
  if (alpha <= 0) return;
  g.globalAlpha = alpha;
  if (img) {
    g.imageSmoothingEnabled = true;
    couvrir(g, img.fond, W, H);
    const s = Math.min(W / img.image.width, H / img.image.height) * zoom;
    g.drawImage(img.image, (W - img.image.width * s) / 2, (H - img.image.height * s) / 2, img.image.width * s, img.image.height * s);
  } else {
    // Pas encore d'image : une carte qui dit ce qu'on y verra (les images viendront au lot 2).
    g.fillStyle = TEINTES[index % TEINTES.length];
    g.fillRect(0, 0, W, H);
    const u = Math.min(W, H);
    texteCentre(g, scene.titre.toUpperCase(), W, H * 0.3, u * 0.035, "rgba(255,255,255,.55)", 600);
    texteCentre(g, scene.voit, W, H * 0.4, u * 0.05, "rgba(255,255,255,.9)");
  }
  g.globalAlpha = 1;
}

function dessinerSousTitre(g: Ctx2D, texte: string, W: number, H: number) {
  if (!texte) return;
  const taille = Math.round(Math.min(W, H) * 0.048);
  g.font = `600 ${taille}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.lineJoin = "round";
  const lignes = lignesSousTitre(texte, W * 0.84, (x) => g.measureText(x).width);
  const y0 = H * 0.84 - (lignes.length - 1) * taille * 1.25;
  lignes.forEach((l, k) => {
    g.lineWidth = taille * 0.18;
    g.strokeStyle = "rgba(0,0,0,.78)";
    g.strokeText(l, W / 2, y0 + k * taille * 1.25);
    g.fillStyle = "#fff";
    g.fillText(l, W / 2, y0 + k * taille * 1.25);
  });
}

/** Dessine l'image du film à l'instant t. */
export function dessinerImage(
  g: Ctx2D,
  W: number,
  H: number,
  t: number,
  cal: Calendrier,
  scenes: readonly SceneFilm[],
  images: readonly (ImageScene | null)[],
  sousTitres: boolean
) {
  g.fillStyle = "#0f0c0a";
  g.fillRect(0, 0, W, H);
  if (!cal.scenes.length) return;
  const i = sceneA(cal, t);
  const p = cal.scenes[i];
  const k = Math.min(1, Math.max(0, (t - p.debut) / Math.max(0.1, p.fin - p.debut)));
  // La scène précédente reste dessous pendant le fondu.
  if (i > 0 && t - p.debut < 0.8) dessinerScene(g, scenes[i - 1], i - 1, images[i - 1] ?? null, 1, 1.05, W, H);
  dessinerScene(g, scenes[i], i, images[i] ?? null, opaciteEntree(cal, i, t), 1 + 0.05 * k, W, H);
  if (sousTitres) dessinerSousTitre(g, sousTitreA(cal, scenes, t), W, H);
}

/** Branche voix et musique sur un contexte audio, à partir de `depuis` secondes du film. */
export function brancherSon(
  ctx: BaseAudioContext,
  dest: AudioNode,
  cal: Calendrier,
  voix: readonly (AudioBuffer | undefined)[],
  musique: AudioBuffer | null,
  t0: number,
  depuis = 0,
  volumeMusique = 1
): AudioScheduledSourceNode[] {
  const sources: AudioScheduledSourceNode[] = [];
  const gv = ctx.createGain();
  gv.gain.value = GAIN_VOIX;
  gv.connect(dest);
  cal.scenes.forEach((p, n) => {
    const b = voix[n];
    if (!b || p.voixDebut === undefined) return;
    const fin = p.voixDebut + b.duration;
    if (fin <= depuis) return;
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(gv);
    s.start(t0 + Math.max(0, p.voixDebut - depuis), Math.max(0, depuis - p.voixDebut));
    sources.push(s);
  });
  if (musique && cal.total > depuis) {
    const gm = ctx.createGain();
    gm.connect(dest);
    // L'enveloppe est rejouée depuis le début, décalée : les paliers passés fixent le niveau présent.
    gm.gain.setValueAtTime(depuis > 0 ? 0.5 * volumeMusique : 0, t0);
    if (depuis === 0) gm.gain.linearRampToValueAtTime(0.5 * volumeMusique, t0 + 1);
    for (const [t, g, c] of paliersMusique(cal)) gm.gain.setTargetAtTime(g * volumeMusique, t0 + Math.max(0, t - depuis), c);
    const m = ctx.createBufferSource();
    m.buffer = musique;
    m.loop = true;
    m.connect(gm);
    m.start(t0, depuis % musique.duration);
    m.stop(t0 + (cal.total - depuis));
    sources.push(m);
  }
  return sources;
}

/** Le son complet du film, mixé hors temps réel. */
export async function mixer(cal: Calendrier, voix: readonly (AudioBuffer | undefined)[], musique: AudioBuffer | null, volumeMusique = 1): Promise<AudioBuffer> {
  const oc = new OfflineAudioContext(2, Math.max(1, Math.ceil(cal.total * TAUX_AUDIO)), TAUX_AUDIO);
  brancherSon(oc, oc.destination, cal, voix, musique, 0, 0, volumeMusique);
  return oc.startRendering();
}

export interface CapacitesEncodage {
  video: VideoEncoderConfig | null;
  audio: AudioEncoderConfig | null;
  /** Vrai si le son n'a pu être encodé qu'en Opus (refusé par certains réseaux). */
  audioOpus: boolean;
}

/** Ce que ce navigateur sait encoder pour un film de cette taille. */
export async function capacites(largeur: number, hauteur: number): Promise<CapacitesEncodage> {
  const res: CapacitesEncodage = { video: null, audio: null, audioOpus: false };
  if (typeof VideoEncoder === "undefined") return res;
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42e028"]) {
    const c: VideoEncoderConfig = { codec, width: largeur, height: hauteur, bitrate: DEBIT_VIDEO, framerate: FPS, avc: { format: "avc" } };
    try {
      if ((await VideoEncoder.isConfigSupported(c)).supported) {
        res.video = c;
        break;
      }
    } catch {
      /* configuration refusée : suivante */
    }
  }
  if (typeof AudioEncoder !== "undefined") {
    for (const codec of ["mp4a.40.2", "opus"]) {
      const c: AudioEncoderConfig = { codec, sampleRate: TAUX_AUDIO, numberOfChannels: 2, bitrate: DEBIT_AUDIO };
      try {
        if ((await AudioEncoder.isConfigSupported(c)).supported) {
          res.audio = c;
          res.audioOpus = codec === "opus";
          break;
        }
      } catch {
        /* suivante */
      }
    }
  }
  return res;
}

/**
 * Fabrique le MP4, image par image. `progression` reçoit 0..1 ; `annule`
 * est consulté entre les images. Rend le fichier, ou lève une erreur lisible.
 */
export async function fabriquerMp4(opts: {
  largeur: number;
  hauteur: number;
  cal: Calendrier;
  scenes: readonly SceneFilm[];
  images: readonly (ImageScene | null)[];
  son: AudioBuffer | null;
  caps: CapacitesEncodage;
  sousTitres: boolean;
  progression: (x: number) => void;
  annule: () => boolean;
}): Promise<Blob> {
  const { largeur: W, hauteur: H, cal, caps } = opts;
  if (!caps.video) throw new Error("Ce navigateur ne sait pas encoder la vidéo en H.264.");
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const avecSon = !!(opts.son && caps.audio);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: "in-memory",
    video: { codec: "avc", width: W, height: H, frameRate: FPS },
    ...(avecSon ? { audio: { codec: caps.audioOpus ? "opus" : "aac", sampleRate: TAUX_AUDIO, numberOfChannels: 2 } } : {}),
  });
  let erreur: Error | null = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (erreur = e) });
  venc.configure(caps.video);
  const t = toile(W, H);
  const g = t.getContext("2d") as Ctx2D;
  const n = Math.max(1, Math.round(cal.total * FPS));
  for (let i = 0; i < n; i++) {
    if (opts.annule()) {
      venc.close();
      throw new Error("annule");
    }
    if (erreur) throw erreur;
    dessinerImage(g, W, H, i / FPS, cal, opts.scenes, opts.images, opts.sousTitres);
    const f = new VideoFrame(t as CanvasImageSource, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    venc.encode(f, { keyFrame: i % (FPS * 2) === 0 });
    f.close();
    if (venc.encodeQueueSize > 8) await new Promise((ok) => venc.addEventListener("dequeue", ok, { once: true }));
    if (i % 15 === 0) {
      opts.progression((i / n) * (avecSon ? 0.95 : 1));
      await new Promise((ok) => setTimeout(ok, 0)); // laisse l'interface respirer
    }
  }
  await venc.flush();
  venc.close();
  if (avecSon && opts.son && caps.audio) {
    const b = opts.son;
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (erreur = e) });
    aenc.configure(caps.audio);
    const pas = 4800;
    for (let o = 0; o < b.length; o += pas) {
      const k = Math.min(pas, b.length - o);
      const data = new Float32Array(k * 2);
      data.set(b.getChannelData(0).subarray(o, o + k), 0);
      data.set(b.getChannelData(Math.min(1, b.numberOfChannels - 1)).subarray(o, o + k), k);
      const ad = new AudioData({ format: "f32-planar", sampleRate: TAUX_AUDIO, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round((o * 1e6) / TAUX_AUDIO), data });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
    aenc.close();
  }
  if (erreur) throw erreur;
  muxer.finalize();
  opts.progression(1);
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
