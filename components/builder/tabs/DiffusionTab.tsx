"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import { ShareLinksSection } from "./ShareLinksSection";
import { CollabSuiviSection } from "./CollabSuiviSection";
import { PanneauPartage } from "@/components/partage/PanneauPartage";
import { cheminPrive } from "@/lib/diffusionPrivee";
import styles from "./DiffusionTab.module.css";

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DiffusionTab() {
  const { currentDraft, updateChannel, updateDiffusionPrivee } = useBuilder();
  const prive = !!currentDraft.diffusionPrivee;
  const cheminPerso = currentDraft.adressePrivee ? cheminPrive(currentDraft.adressePrivee) : null;
  const origine = typeof window !== "undefined" ? window.location.origin : "https://getgents.ai";
  const channel = currentDraft.channel;
  const isEmail = channel?.kind === "email";
  const to = channel?.to?.trim() ?? "";
  const toOk = isEmail ? EMAIL.test(to) : E164.test(to);

  return (
    <div className={styles.wrap}>
      <div className={[styles.card, prive ? styles.cardPrive : ""].filter(Boolean).join(" ")}>
        <label className={styles.priveLigne} htmlFor="diffusion-privee">
          <input
            type="checkbox"
            id="diffusion-privee"
            checked={prive}
            onChange={(e) => updateDiffusionPrivee(e.target.checked)}
          />
          <span>
            <b>Diffusion privée</b> — le gent est réservé à votre usage, dans votre espace GetSpace. Page publique,
            liens de partage, salon et invitations sont fermés tant que la case est cochée ; les décocher les
            rétablit tels quels.
          </span>
        </label>
        {prive && cheminPerso && (
          <div className={styles.priveAdresse}>
            Votre adresse : <code>{`${origine.replace(/^https?:\/\//, "")}${cheminPerso}`}</code>
            <a href={cheminPerso} target="_blank" rel="noopener noreferrer" className={styles.priveLien}>
              Ouvrir ↗
            </a>
          </div>
        )}
        {prive && (
          <p className={styles.priveNote}>
            « Diffuser le gent » met à jour la version que vous utilisez dans votre espace. La note de routine
            (ci-dessous) reste envoyée à l&apos;adresse choisie.
          </p>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.headRow}>
          <div>
            <h4 className={styles.title}>Diffusion de la note</h4>
            <div className={styles.sub}>
              Quand la routine produit une note, elle est envoyée au destinataire sur le canal
              choisi (en plus de l&apos;artefact dans l&apos;espace). L&apos;envoi se fait côté
              serveur.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!channel?.enabled}
            className={[styles.switch, channel?.enabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updateChannel({ enabled: !channel?.enabled })}
            aria-label="Activer la diffusion"
          >
            <span className={styles.knob} />
          </button>
        </div>

        {channel?.enabled && (
          <div className={styles.config}>
            <div className={styles.segRow} role="tablist" aria-label="Canal de diffusion">
              <button
                type="button"
                role="tab"
                aria-selected={isEmail}
                className={[styles.seg, isEmail ? styles.segOn : ""].filter(Boolean).join(" ")}
                onClick={() => updateChannel({ kind: "email", to: "", optInAt: undefined })}
              >
                ✉️ E-mail
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isEmail}
                className={[styles.seg, !isEmail ? styles.segOn : ""].filter(Boolean).join(" ")}
                onClick={() => updateChannel({ kind: "whatsapp", to: "", optInAt: undefined })}
              >
                💬 WhatsApp
              </button>
            </div>

            <label className={styles.fieldLabel} htmlFor="chan-to">
              {isEmail ? "Adresse e-mail du destinataire" : "Numéro WhatsApp (format international)"}
            </label>
            <input
              id="chan-to"
              className={styles.input}
              type={isEmail ? "email" : "tel"}
              placeholder={isEmail ? "prenom@exemple.fr" : "+33612345678"}
              value={channel.to}
              onChange={(e) => updateChannel({ to: e.target.value, optInAt: undefined })}
              aria-label={isEmail ? "Adresse e-mail du destinataire" : "Numéro WhatsApp du destinataire"}
            />
            {to && !toOk && (
              <div className={styles.warn}>
                {isEmail ? "Adresse e-mail invalide." : "Format attendu : indicatif + numéro, ex. +33612345678"}
              </div>
            )}

            <label className={[styles.optIn, !toOk ? styles.optInDisabled : ""].filter(Boolean).join(" ")}>
              <input
                type="checkbox"
                checked={!!channel.optInAt}
                disabled={!toOk}
                onChange={(e) => updateChannel({ optInAt: e.target.checked ? new Date().toISOString() : undefined })}
              />
              <span>
                Le destinataire a donné son <strong>consentement</strong> pour recevoir ces messages.
              </span>
            </label>

            {!isEmail && (
              <div className={styles.templateBlock}>
                <div className={styles.templateRow}>
                  <div className={styles.templateField}>
                    <label className={styles.fieldLabel} htmlFor="wa-template">
                      Template approuvé (note quotidienne)
                    </label>
                    <input
                      id="wa-template"
                      className={styles.input}
                      placeholder="ex. veille_quotidienne"
                      value={channel.templateName ?? ""}
                      onChange={(e) => updateChannel({ templateName: e.target.value || undefined })}
                      aria-label="Nom du template WhatsApp"
                    />
                  </div>
                  <div className={styles.templateFieldSmall}>
                    <label className={styles.fieldLabel} htmlFor="wa-lang">
                      Langue
                    </label>
                    <input
                      id="wa-lang"
                      className={styles.input}
                      placeholder="fr"
                      value={channel.templateLang ?? ""}
                      onChange={(e) => updateChannel({ templateLang: e.target.value || undefined })}
                      aria-label="Code langue du template"
                    />
                  </div>
                </div>
                <div className={styles.templateHint}>
                  Requis pour l&apos;envoi quotidien non sollicité. Créez dans Meta un template à 2
                  variables de corps ({"{{1}}"} = titre, {"{{2}}"} = extrait). Sans template, la note
                  ne part qu&apos;en texte libre (fenêtre de 24 h). La conversation entrante, elle,
                  répond toujours en texte libre.
                </div>
              </div>
            )}

            <div className={styles.note}>
              {isEmail ? (
                <>
                  Envoi via Brevo — configurez <code> BREVO_API_KEY </code> et
                  <code> BREVO_SENDER_EMAIL </code> côté serveur (expéditeur vérifié dans Brevo).
                </>
              ) : (
                <>
                  Configurez <code> WHATSAPP_TOKEN </code>, <code> WHATSAPP_PHONE_NUMBER_ID </code> et
                  <code> WHATSAPP_VERIFY_TOKEN </code> (webhook entrant) côté serveur.
                </>
              )}
            </div>

            {channel.lastDeliveryNote && (
              <div className={styles.status}>Dernière livraison : {channel.lastDeliveryNote}</div>
            )}
          </div>
        )}
      </div>

      {/* Diffusion privée : les autres modes restent visibles (on voit ce qui
          est fermé et ce qui reviendra), mais inactifs — et le serveur les
          refuse de toute façon. */}
      <fieldset className={prive ? styles.ferme : styles.ouvert} disabled={prive} aria-disabled={prive}>
        {prive && <p className={styles.fermeNote}>Fermé : ce gent est en diffusion privée.</p>}
        <PanneauPartage />
        <ShareLinksSection />
        <CollabSuiviSection />
      </fieldset>

      <div className={styles.card}>
        <h4 className={styles.title}>Autres canaux</h4>
        <div className={styles.channels}>
          {[{ icon: "🌐", title: "Intégration web", desc: "Widget/iframe sur votre site." }].map((c) => (
            <div className={styles.channel} key={c.title}>
              <div className={styles.channelIc}>{c.icon}</div>
              <div>
                <div className={styles.channelTitle}>{c.title}</div>
                <div className={styles.channelDesc}>{c.desc}</div>
              </div>
              <span className={styles.soon}>Bientôt</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
