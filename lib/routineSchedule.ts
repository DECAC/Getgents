// Logique de planification des routines — module pur (aucune dépendance),
// utilisable côté serveur (runner) comme côté client (affichage) et testable
// sans l'environnement du runner.
import type { Routine } from "@/lib/types";

export function parisParts(d: Date): { ymd: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { ymd: `${parts.year}-${parts.month}-${parts.day}`, hour: parseInt(parts.hour, 10) };
}

/**
 * Une routine est due si son heure (Paris) est atteinte et qu'elle n'a pas
 * déjà tourné sur sa période courante (le jour pour daily, la fenêtre de
 * ~7 jours pour weekly). Le cron peut donc frapper toutes les heures sans
 * double exécution.
 */
export function isRoutineDue(routine: Routine, now: Date = new Date()): boolean {
  if (!routine.enabled || !routine.mission.trim()) return false;
  const { ymd, hour } = parisParts(now);
  if (hour < routine.hour) return false;
  if (!routine.lastRunAt) return true;
  const last = new Date(routine.lastRunAt);
  if (Number.isNaN(last.getTime())) return true;
  if (routine.frequency === "daily") {
    return parisParts(last).ymd !== ymd;
  }
  // weekly : au moins 6 jours pleins depuis le dernier run.
  return now.getTime() - last.getTime() >= 6 * 24 * 3600 * 1000;
}
