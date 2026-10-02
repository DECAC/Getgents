/**
 * Synthèse des musiques d'habillage dans le navigateur (Web Audio, rendu
 * HORS TEMPS RÉEL) : la partition de lib/musiqueHabillage.ts devient un
 * AudioBuffer de la durée exacte de la vidéo, courbe de volume comprise.
 * Aperçu et export lisent le même tampon : ce qu'on entend est ce qui part.
 */

import type { PointVolume } from "@/lib/habillage";
import { coupureDe, frequence, partition, type NoteMusique, type StyleGenere } from "@/lib/musiqueHabillage";

const FREQUENCE_ECH = 44100;

type ContexteHorsLigne = OfflineAudioContext;

function contexteHorsLigne(duree: number): ContexteHorsLigne {
  const Ctx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctx) throw new Error("Web Audio indisponible");
  return new Ctx(2, Math.max(1, Math.ceil(duree * FREQUENCE_ECH)), FREQUENCE_ECH);
}

/** Courbe de volume appliquée à un gain (fondus, baisse sous la voix). */
function appliquerEnveloppe(gain: AudioParam, points: PointVolume[]) {
  if (!points.length) return;
  gain.setValueAtTime(points[0].g, points[0].t);
  for (const p of points.slice(1)) gain.linearRampToValueAtTime(p.g, p.t);
}

function bruitBlanc(ctx: ContexteHorsLigne): AudioBuffer {
  const tampon = ctx.createBuffer(1, FREQUENCE_ECH, FREQUENCE_ECH);
  const d = tampon.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return tampon;
}

/** Une note : chaque instrument est un petit montage d'oscillateurs et de filtres. */
function jouer(ctx: ContexteHorsLigne, sortie: AudioNode, n: NoteMusique, bruit: AudioBuffer) {
  const t0 = n.t;
  const v = n.force;
  const enveloppe = ctx.createGain();
  enveloppe.gain.setValueAtTime(0, t0);
  enveloppe.connect(sortie);
  const fin = (t: number, ...sources: AudioScheduledSourceNode[]) =>
    sources.forEach((s) => {
      s.start(t0);
      s.stop(t);
    });

  switch (n.instrument) {
    case "nappe": {
      // Deux dents de scie désaccordées, adoucies : une nappe de cordes.
      const filtre = ctx.createBiquadFilter();
      filtre.type = "lowpass";
      filtre.frequency.value = 1400;
      filtre.connect(enveloppe);
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = b.type = "sawtooth";
      a.frequency.value = b.frequency.value = frequence(n.hauteur);
      a.detune.value = -7;
      b.detune.value = 7;
      a.connect(filtre);
      b.connect(filtre);
      const attaque = Math.min(0.6, n.duree / 3);
      enveloppe.gain.linearRampToValueAtTime(v * 0.035, t0 + attaque);
      enveloppe.gain.setValueAtTime(v * 0.035, t0 + n.duree);
      enveloppe.gain.linearRampToValueAtTime(0, t0 + n.duree + 0.6);
      fin(t0 + n.duree + 0.7, a, b);
      break;
    }
    case "pince": {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = frequence(n.hauteur);
      o.connect(enveloppe);
      const d = Math.min(0.5, n.duree + 0.3);
      enveloppe.gain.linearRampToValueAtTime(v * 0.1, t0 + 0.005);
      enveloppe.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      fin(t0 + d + 0.02, o);
      break;
    }
    case "piano": {
      // Sinus et triangle, légèrement désaccordés au hasard : le flottement
      // d'un piano électrique un peu usé, signature du lo-fi.
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.type = "sine";
      b.type = "triangle";
      a.frequency.value = b.frequency.value = frequence(n.hauteur);
      a.detune.value = (Math.random() - 0.5) * 10;
      b.detune.value = (Math.random() - 0.5) * 10;
      const mixB = ctx.createGain();
      mixB.gain.value = 0.35;
      a.connect(enveloppe);
      b.connect(mixB).connect(enveloppe);
      enveloppe.gain.linearRampToValueAtTime(v * 0.07, t0 + 0.01);
      enveloppe.gain.exponentialRampToValueAtTime(v * 0.025, t0 + 0.8);
      enveloppe.gain.setValueAtTime(v * 0.025, t0 + n.duree);
      enveloppe.gain.exponentialRampToValueAtTime(0.0001, t0 + n.duree + 0.4);
      fin(t0 + n.duree + 0.45, a, b);
      break;
    }
    case "basse": {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = frequence(n.hauteur);
      o.connect(enveloppe);
      const d = Math.max(0.25, Math.min(n.duree, 1.2));
      enveloppe.gain.linearRampToValueAtTime(v * 0.2, t0 + 0.01);
      enveloppe.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      fin(t0 + d + 0.02, o);
      break;
    }
    case "grosseCaisse": {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
      o.connect(enveloppe);
      enveloppe.gain.linearRampToValueAtTime(v * 0.45, t0 + 0.003);
      enveloppe.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      fin(t0 + 0.37, o);
      break;
    }
    case "caisse":
    case "charley": {
      const s = ctx.createBufferSource();
      s.buffer = bruit;
      const filtre = ctx.createBiquadFilter();
      const caisse = n.instrument === "caisse";
      filtre.type = caisse ? "bandpass" : "highpass";
      filtre.frequency.value = caisse ? 1800 : 7000;
      s.connect(filtre).connect(enveloppe);
      const d = caisse ? 0.18 : 0.05;
      enveloppe.gain.linearRampToValueAtTime(v * (caisse ? 0.16 : 0.05), t0 + 0.002);
      enveloppe.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      s.start(t0, Math.random() * 0.5);
      s.stop(t0 + d + 0.02);
      break;
    }
  }
}

/** Musique générée, de `duree` secondes, courbe de volume comprise. */
export async function genererMusique(style: StyleGenere, duree: number, enveloppe: PointVolume[]): Promise<AudioBuffer> {
  const ctx = contexteHorsLigne(duree);
  const general = ctx.createGain();
  appliquerEnveloppe(general.gain, enveloppe);
  const filtre = ctx.createBiquadFilter();
  filtre.type = "lowpass";
  filtre.frequency.value = coupureDe(style);
  const compresseur = ctx.createDynamicsCompressor();
  const entree = ctx.createGain();
  entree.connect(filtre).connect(compresseur).connect(general).connect(ctx.destination);
  const bruit = bruitBlanc(ctx);
  for (const n of partition(style, duree)) jouer(ctx, entree, n, bruit);
  return ctx.startRendering();
}

/** Musique importée : bouclée si elle est plus courte que la vidéo, même courbe de volume. */
export async function preparerMusiqueImportee(source: AudioBuffer, duree: number, enveloppe: PointVolume[]): Promise<AudioBuffer> {
  const ctx = contexteHorsLigne(duree);
  const general = ctx.createGain();
  appliquerEnveloppe(general.gain, enveloppe);
  general.connect(ctx.destination);
  const s = ctx.createBufferSource();
  s.buffer = source;
  s.loop = source.duration < duree;
  s.connect(general);
  s.start(0);
  return ctx.startRendering();
}
