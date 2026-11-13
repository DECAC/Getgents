import { getSupabaseAdmin } from "@/lib/server/supabase";
import { detailPage } from "@/lib/server/pages";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/server/brevo";
import {
  CONSERVATION_JOURS,
  jourParis,
  mailPremiereLecture,
  syntheseActivite,
  type Activite,
  type Appareil,
  type Battement,
  type LigneLecture,
  type LigneQuestion,
} from "@/lib/activitePage";
import { normaliserNomAffiche } from "@/lib/nomAffiche";
import type { ArtefactPartage } from "@/lib/server/artefactsPartages";

/**
 * Activité d'une page partagée (migration 024) : lectures et questions, dans
 * deux tables SANS clé commune. Voir lib/activitePage.ts pour les règles.
 *
 * Table absente (déployé avant la migration) : rien n'est mesuré, rien ne
 * casse — le visiteur lit sa page, l'onglet Activité dit que la mesure n'est
 * pas en place. Jamais une erreur de mesure ne bloque la lecture.
 */

const tableAbsente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

interface LectureStockee extends LigneLecture {
  id: string;
  pageId: string;
}
interface QuestionStockee extends LigneQuestion {
  id: string;
  pageId: string;
}
interface Memoire {
  lectures: Map<string, LectureStockee>;
  questions: QuestionStockee[];
}
const memoire = (): Memoire => {
  const g = globalThis as unknown as { __activitePages?: Memoire };
  return (g.__activitePages ??= { lectures: new Map(), questions: [] });
};

const journal = (event: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ tag: "getgents:activite", event, ...extra }));

/** Courriel de l'auteur, pour la notification de première lecture partagée. */
async function courrielAuteur(ownerId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.auth.admin.getUserById(ownerId);
  return data?.user?.email ?? null;
}

/** Nom affiché de l'auteur (Mon compte), pour « Vos données sur cette page ». Null s'il n'en a pas. */
export async function nomAuteur(ownerId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.admin.getUserById(ownerId);
    return normaliserNomAffiche(data?.user?.user_metadata?.nom_affiche) || null;
  } catch {
    return null;
  }
}

/**
 * Un battement du navigateur. Anonyme : une ligne par visite, le JOUR
 * seulement — durée, profondeur, appareil et lien ne sont pas gardés.
 * Partagé : la visite complète, et un e-mail à l'auteur à la toute première
 * lecture partagée de ce destinataire.
 */
export async function enregistrerLecture(
  a: Pick<ArtefactPartage, "jeton" | "pageId" | "ownerId" | "titre" | "destinataire" | "version">,
  b: Battement,
  appareil: Appareil,
  origine: string
): Promise<void> {
  if (!a.pageId) return;
  const maintenant = new Date();
  const ligne: LectureStockee = b.consentement
    ? { id: b.visite, pageId: a.pageId, jeton: a.jeton, jour: jourParis(maintenant), debut: maintenant.toISOString(), duree: b.duree, profondeur: b.profondeur, appareil, version: a.version }
    : { id: b.visite, pageId: a.pageId, jeton: null, jour: jourParis(maintenant), debut: null, duree: 0, profondeur: null, appareil: null, version: null };

  const sb = getSupabaseAdmin();
  let premiere = false;
  if (!sb) {
    const m = memoire().lectures;
    const avant = m.get(b.visite);
    if (avant) {
      // Une visite ne change pas de nature : un identifiant anonyme ne devient pas nominatif.
      if (!!avant.jeton !== b.consentement) return;
      if (b.consentement) {
        avant.duree = Math.max(avant.duree, b.duree);
        if (b.profondeur !== null) avant.profondeur = Math.max(avant.profondeur ?? 0, b.profondeur);
      }
      return;
    }
    premiere = b.consentement && !Array.from(m.values()).some((l) => l.jeton === a.jeton);
    m.set(b.visite, ligne);
  } else {
    const { data: avant, error: e1 } = await sb.from("pages_lectures").select("jeton, duree_s, profondeur").eq("id", b.visite).maybeSingle();
    if (tableAbsente(e1)) return;
    if (e1) throw new Error(e1.message);
    if (avant) {
      if (!!avant.jeton !== b.consentement || !b.consentement) return;
      const { error } = await sb
        .from("pages_lectures")
        .update({
          duree_s: Math.max(avant.duree_s ?? 0, b.duree),
          profondeur: b.profondeur === null ? avant.profondeur : Math.max(avant.profondeur ?? 0, b.profondeur),
          maj: maintenant.toISOString(),
        })
        .eq("id", b.visite);
      if (error) throw new Error(error.message);
      return;
    }
    if (b.consentement) {
      const { count } = await sb.from("pages_lectures").select("id", { count: "exact", head: true }).eq("jeton", a.jeton);
      premiere = (count ?? 0) === 0;
    }
    const { error } = await sb.from("pages_lectures").insert({
      id: ligne.id,
      page_id: ligne.pageId,
      jeton: ligne.jeton,
      jour: ligne.jour,
      debut: ligne.debut,
      duree_s: ligne.duree,
      profondeur: ligne.profondeur,
      appareil: ligne.appareil,
      version: ligne.version,
    });
    // Deux battements simultanés de la même visite : le second perd, sans gravité.
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  journal(b.consentement ? "lecture_partagee" : "lecture_anonyme", { premiere: premiere || undefined });

  if (premiere && a.ownerId) {
    const courriel = await courrielAuteur(a.ownerId);
    if (!courriel || !isBrevoConfigured()) return journal("notification_non_envoyee", { cause: courriel ? "brevo" : "courriel" });
    const mail = mailPremiereLecture({ titre: a.titre, destinataire: a.destinataire, lienFiche: `${origine}/pages/${a.pageId}` });
    const r = await sendBrevoEmail(courriel, mail.objet, mail.html);
    journal(r.ok ? "notification_envoyee" : "notification_non_envoyee", r.ok ? {} : { note: r.note });
  }
}

/** Une question posée à l'assistant : la page et le jour, rien d'autre. Rend son identifiant. */
export async function enregistrerQuestion(pageId: string | null, question: string): Promise<string | null> {
  if (!pageId) return null;
  const q = question.trim().slice(0, 2000);
  if (!q) return null;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const id = crypto.randomUUID();
    memoire().questions.push({ id, pageId, jour: jourParis(), question: q, horsPage: null });
    return id;
  }
  const { data, error } = await sb.from("pages_questions").insert({ page_id: pageId, jour: jourParis(), question: q }).select("id").single();
  if (tableAbsente(error)) return null;
  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * Questions posées depuis `depuis` (AAAA-MM-JJ) aux assistants des pages
 * données — plafond mensuel de l'offre « pages ». Table absente : 0.
 */
export async function questionsDepuis(pageIds: string[], depuis: string): Promise<number> {
  if (!pageIds.length) return 0;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const ids = new Set(pageIds);
    return memoire().questions.filter((q) => ids.has(q.pageId) && q.jour >= depuis).length;
  }
  const { count, error } = await sb.from("pages_questions").select("id", { count: "exact", head: true }).in("page_id", pageIds).gte("jour", depuis);
  if (tableAbsente(error)) return 0;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Une fois la réponse écrite : l'information manquait-elle dans la page ? */
export async function marquerQuestion(id: string, horsPage: boolean): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const q = memoire().questions.find((x) => x.id === id);
    if (q) q.horsPage = horsPage;
    return;
  }
  const { error } = await sb.from("pages_questions").update({ hors_page: horsPage }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Efface ce qui a dépassé la durée promise au visiteur. */
export async function purgerActivite(): Promise<void> {
  const limite = jourParis(new Date(Date.now() - CONSERVATION_JOURS * 86_400_000));
  const sb = getSupabaseAdmin();
  if (!sb) {
    const m = memoire();
    for (const [k, l] of Array.from(m.lectures)) if (l.jour < limite) m.lectures.delete(k);
    m.questions = m.questions.filter((q) => q.jour >= limite);
    return;
  }
  for (const table of ["pages_lectures", "pages_questions"]) {
    const { error } = await sb.from(table).delete().lt("jour", limite);
    if (error && !tableAbsente(error)) throw new Error(`${table} : ${error.message}`);
  }
}

export type ResultatActivite = { ok: true; activite: Activite } | { ok: false; raison: "introuvable" | "migration_manquante" };

/** L'onglet Activité d'une page DE CE COMPTE. */
export async function activitePage(ownerId: string, pageId: string): Promise<ResultatActivite> {
  const detail = await detailPage(ownerId, pageId);
  if (!detail) return { ok: false, raison: "introuvable" };
  await purgerActivite().catch((e) => journal("purge_echouee", { detail: (e as Error).message }));
  const destinataires = detail.destinataires.filter((d) => !d.revokedAt).map((d) => ({ jeton: d.jeton, destinataire: d.destinataire }));

  const sb = getSupabaseAdmin();
  let lectures: LigneLecture[];
  let questions: LigneQuestion[];
  if (!sb) {
    lectures = Array.from(memoire().lectures.values()).filter((l) => l.pageId === pageId);
    questions = memoire().questions.filter((q) => q.pageId === pageId);
  } else {
    const [l, q] = await Promise.all([
      sb.from("pages_lectures").select("jeton, jour, debut, duree_s, profondeur, appareil, version").eq("page_id", pageId).limit(5000),
      sb.from("pages_questions").select("id, jour, question, hors_page").eq("page_id", pageId).order("jour", { ascending: false }).limit(1000),
    ]);
    if (tableAbsente(l.error) || tableAbsente(q.error)) return { ok: false, raison: "migration_manquante" };
    if (l.error) throw new Error(l.error.message);
    if (q.error) throw new Error(q.error.message);
    lectures = (l.data ?? []).map((d) => ({
      jeton: d.jeton,
      jour: d.jour,
      debut: d.debut,
      duree: d.duree_s ?? 0,
      profondeur: d.profondeur,
      appareil: d.appareil,
      version: d.version,
    }));
    questions = (q.data ?? []).map((d) => ({ id: d.id, jour: d.jour, question: d.question, horsPage: d.hors_page }));
  }
  return { ok: true, activite: syntheseActivite(destinataires, lectures, questions) };
}
