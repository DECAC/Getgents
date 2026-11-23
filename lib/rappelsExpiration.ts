import { SEUIL_RAPPEL_HEURES } from "./dureeLien";
import { LIENS_PAR_MAIL, mailRappelExpiration } from "./emailRappelExpiration";
import { signerJetonRappel } from "./jetonRappel";

/**
 * Rappel d'expiration (lot « Partager », étape 2) : l'ORCHESTRATION, sans
 * accès à la base ni à Brevo — ils sont passés en `deps`, ce qui la rend
 * testable. Règles (23/11, choix de l'éditeur : 48 h avant l'échéance) :
 *
 *   - un lien actif, d'un compte, à moins de 48 h de l'échéance, sans rappel ;
 *   - UN e-mail par auteur et par jour : la tâche est horaire, mais n'envoie
 *     que dans la fenêtre de 8 h (heure de Paris) — un lien est donc rappelé
 *     entre 24 h et 48 h avant son échéance ;
 *   - le lien est MARQUÉ seulement après l'envoi réussi (un échec est retenté
 *     le lendemain) ; un auteur qui a coupé les rappels, ou sans adresse
 *     confirmée, voit ses liens marqués aussi (sinon la tâche les relirait
 *     chaque jour) ;
 *   - 100 auteurs au plus par passage.
 */

export interface LienARappeler {
  jeton: string;
  ownerId: string;
  destinataire: string;
  titrePage: string;
  expiresAt: string;
}

export interface DepsRappels {
  /** Liens actifs avec échéance dans [maintenant, limite], sans rappel déjà envoyé. */
  liens: (maintenant: number, limite: number) => Promise<LienARappeler[]>;
  auteur: (ownerId: string) => Promise<{ email: string | null; nom: string | null; rappels: boolean }>;
  envoyer: (to: string, objet: string, html: string) => Promise<{ ok: boolean; note: string }>;
  marquer: (jetons: string[], quand: string) => Promise<void>;
  cle: string;
  /** Origine publique du site (`https://getgents.ai`). */
  origine: string;
}

export interface BilanRappels {
  fenetre: boolean;
  auteurs: number;
  envoyes: number;
  echecs: number;
  ignores: number;
  liensMarques: number;
  /** Seulement pour les tests et le diagnostic : les messages composés, sans adresse. */
  mails?: { ownerId: string; objet: string; html: string }[];
}

export const AUTEURS_PAR_PASSAGE = 100;
export const HEURE_RAPPEL_PARIS = 8;

export function heureDeParis(maintenant: number): number {
  // Locale « en-GB » : « 08 », là où « fr-FR » rend « 08 h » (Number → NaN, aucun rappel ne partirait).
  const heure = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Paris" }).formatToParts(new Date(maintenant)).find((p) => p.type === "hour");
  return Number(heure?.value);
}

export async function orchestrerRappels(maintenant: number, deps: DepsRappels, opts: { ignorerFenetre?: boolean; garderMails?: boolean } = {}): Promise<BilanRappels> {
  const bilan: BilanRappels = { fenetre: opts.ignorerFenetre === true || heureDeParis(maintenant) === HEURE_RAPPEL_PARIS, auteurs: 0, envoyes: 0, echecs: 0, ignores: 0, liensMarques: 0 };
  if (opts.garderMails) bilan.mails = [];
  if (!bilan.fenetre) return bilan;

  const limite = maintenant + SEUIL_RAPPEL_HEURES * 3600 * 1000;
  const tous = await deps.liens(maintenant, limite);
  const parAuteur = new Map<string, LienARappeler[]>();
  for (const l of tous) parAuteur.set(l.ownerId, [...(parAuteur.get(l.ownerId) ?? []), l]);

  const quand = new Date(maintenant).toISOString();
  for (const [ownerId, liens] of Array.from(parAuteur).slice(0, AUTEURS_PAR_PASSAGE)) {
    bilan.auteurs++;
    const a = await deps.auteur(ownerId).catch(() => null);
    if (!a) continue; // lecture en échec : on réessaiera demain
    const jetons = liens.map((l) => l.jeton);
    if (!a.rappels || !a.email) {
      await deps.marquer(jetons, quand);
      bilan.ignores++;
      bilan.liensMarques += jetons.length;
      continue;
    }
    const tries = [...liens].sort((x, y) => x.expiresAt.localeCompare(y.expiresAt));
    const url = (jeton: string) => `${deps.origine}/partage/rappel/${jeton}`;
    const sign = (action: Parameters<typeof signerJetonRappel>[0]) => url(signerJetonRappel(action, { cle: deps.cle, maintenant }));
    const mail = mailRappelExpiration({
      liens: tries.slice(0, LIENS_PAR_MAIL).map((l) => ({
        destinataire: l.destinataire,
        titrePage: l.titrePage,
        expiresAt: l.expiresAt,
        urlProlonger: sign({ t: "p", u: ownerId, j: l.jeton }),
      })),
      total: tries.length,
      // Tout ce qui expire dans la fenêtre — la page de confirmation le liste avant d'agir.
      urlTout: sign({ t: "pt", u: ownerId, de: maintenant, a: limite }),
      urlPages: `${deps.origine}/pages`,
      urlDesabonner: sign({ t: "d", u: ownerId }),
      nom: a.nom,
    });
    const r = await deps.envoyer(a.email, mail.objet, mail.html).catch((e) => ({ ok: false, note: (e as Error).message }));
    if (!r.ok) {
      bilan.echecs++;
      console.error(JSON.stringify({ tag: "getgents:rappels", event: "envoi_echoue", cause: r.note.slice(0, 120) }));
      continue;
    }
    await deps.marquer(jetons, quand);
    bilan.envoyes++;
    bilan.liensMarques += jetons.length;
    bilan.mails?.push({ ownerId, objet: mail.objet, html: mail.html });
  }
  return bilan;
}
