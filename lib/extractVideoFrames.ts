// Extraction d'images clés d'une vidéo côté navigateur (canvas + élément <video>).
// Les frames sont ensuite analysées par un modèle vision via /api/video/analyze.

export interface VideoFrame {
  /** Position dans la vidéo (secondes). */
  timeSec: number;
  /** JPEG en data URL (data:image/jpeg;base64,…). */
  dataUrl: string;
}

export interface ExtractedVideo {
  name: string;
  durationSec: number;
  frames: VideoFrame[];
}

/** Taille max du fichier vidéo (Mo). */
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
/** Durée max analysée (secondes). */
export const MAX_VIDEO_DURATION_SEC = 600;
/** Nombre d'images extraites pour l'analyse vision. */
export const MAX_VIDEO_FRAMES = 15;
/** Largeur max d'une frame envoyée au modèle (px). */
export const MAX_FRAME_WIDTH_PX = 1280;

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv"];
const VIDEO_MIME_PREFIXES = ["video/"];

export function isVideoFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  return VIDEO_MIME_PREFIXES.some((p) => file.type.startsWith(p));
}

/** Instants d'extraction répartis sur la durée (évite t=0 et la toute fin). */
export function pickFrameTimes(durationSec: number, count: number): number[] {
  const n = Math.max(1, Math.min(count, MAX_VIDEO_FRAMES));
  if (durationSec <= 0) return [0];
  if (n === 1) return [Math.min(durationSec * 0.5, Math.max(0, durationSec - 0.1))];
  const start = Math.min(0.5, durationSec * 0.05);
  const end = Math.max(start + 0.1, durationSec - 0.5);
  const span = end - start;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(start + (span * i) / (n - 1));
  }
  return out.map((t) => Math.round(t * 10) / 10);
}

function loadVideoMetadata(url: string): Promise<{ durationSec: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    video.onloadedmetadata = () => {
      const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
      resolve({ durationSec, width: video.videoWidth, height: video.videoHeight });
      cleanup();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Impossible de lire cette vidéo (format ou fichier endommagé)."));
    };
    video.src = url;
  });
}

function captureFrameAt(
  video: HTMLVideoElement,
  timeSec: number,
  maxWidth: number
): Promise<VideoFrame> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) {
          reject(new Error("Dimensions vidéo invalides."));
          return;
        }
        const scale = vw > maxWidth ? maxWidth / vw : 1;
        const cw = Math.max(1, Math.round(vw * scale));
        const ch = Math.max(1, Math.round(vh * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Capture d'image impossible dans ce navigateur."));
          return;
        }
        ctx.drawImage(video, 0, 0, cw, ch);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve({ timeSec, dataUrl });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Échec de la capture d'image."));
      }
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Lecture vidéo interrompue pendant l'extraction des images."));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = Math.max(0, timeSec);
  });
}

/** Extrait des images clés d'un fichier vidéo pour analyse vision. */
export async function extractVideoFrames(file: File): Promise<ExtractedVideo> {
  if (!isVideoFile(file)) {
    throw new Error("Format vidéo non pris en charge. Utilisez MP4, WebM ou MOV.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Vidéo trop volumineuse (${Math.round(file.size / (1024 * 1024))} Mo). Limite : ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} Mo.`
    );
  }

  const blobUrl = URL.createObjectURL(file);
  const meta = await loadVideoMetadata(blobUrl);
  if (meta.durationSec <= 0) {
    throw new Error("Durée de la vidéo illisible.");
  }
  if (meta.durationSec > MAX_VIDEO_DURATION_SEC) {
    throw new Error(
      `Vidéo trop longue (${Math.round(meta.durationSec)} s). Limite : ${Math.floor(MAX_VIDEO_DURATION_SEC / 60)} minutes.`
    );
  }

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = blobUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Impossible de décoder cette vidéo."));
  });

  const times = pickFrameTimes(meta.durationSec, MAX_VIDEO_FRAMES);
  const frames: VideoFrame[] = [];
  for (const timeSec of times) {
    frames.push(await captureFrameAt(video, timeSec, MAX_FRAME_WIDTH_PX));
  }

  video.removeAttribute("src");
  video.load();
  URL.revokeObjectURL(blobUrl);

  return { name: file.name, durationSec: meta.durationSec, frames };
}

export function formatVideoDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}
