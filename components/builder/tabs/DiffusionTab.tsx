"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import styles from "./DiffusionTab.module.css";

// Format E.164 permissif (ex. +33612345678) — validation d'affichage, la
// vérification réelle est faite par Meta à l'envoi.
const E164 = /^\+[1-9]\d{6,14}$/;

export function DiffusionTab() {
  const { currentDraft, updateChannel } = useBuilder();
  const channel = currentDraft.channel;
  const numberOk = !!channel?.to && E164.test(channel.to.trim());

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.headRow}>
          <div>
            <h4 className={styles.title}>Diffusion WhatsApp</h4>
            <div className={styles.sub}>
              Quand la routine produit une note, un résumé + lien est envoyé sur WhatsApp au
              destinataire. L&apos;envoi utilise l&apos;API WhatsApp Business (secrets côté serveur).
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!channel?.enabled}
            className={[styles.switch, channel?.enabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updateChannel({ enabled: !channel?.enabled })}
            aria-label="Activer la diffusion WhatsApp"
          >
            <span className={styles.knob} />
          </button>
        </div>

        {channel?.enabled && (
          <div className={styles.config}>
            <label className={styles.fieldLabel} htmlFor="wa-number">
              Numéro du destinataire (format international)
            </label>
            <input
              id="wa-number"
              className={styles.input}
              type="tel"
              placeholder="+33612345678"
              value={channel.to}
              onChange={(e) => updateChannel({ to: e.target.value, optInAt: undefined })}
              aria-label="Numéro WhatsApp du destinataire"
            />
            {channel.to.trim() && !numberOk && (
              <div className={styles.warn}>Format attendu : indicatif pays + numéro, ex. +33612345678</div>
            )}

            <label
              className={[styles.optIn, !numberOk ? styles.optInDisabled : ""].filter(Boolean).join(" ")}
            >
              <input
                type="checkbox"
                checked={!!channel.optInAt}
                disabled={!numberOk}
                onChange={(e) => updateChannel({ optInAt: e.target.checked ? new Date().toISOString() : undefined })}
              />
              <span>
                Le destinataire a donné son <strong>consentement</strong> pour recevoir ces messages
                sur WhatsApp (opt-in requis par Meta).
              </span>
            </label>

            <div className={styles.note}>
              Hors de la fenêtre de 24 h suivant un message du destinataire, Meta n&apos;autorise que
              des messages « template » pré-approuvés — un simple texte peut être refusé. Configurez
              <code> WHATSAPP_TOKEN </code> et <code> WHATSAPP_PHONE_NUMBER_ID </code> côté serveur.
            </div>

            {channel.lastDeliveryNote && (
              <div className={styles.status}>Dernière livraison : {channel.lastDeliveryNote}</div>
            )}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h4 className={styles.title}>Autres canaux</h4>
        <div className={styles.channels}>
          {[
            { icon: "✉️", title: "E-mail", desc: "Recevoir la note par e-mail." },
            { icon: "🔗", title: "Lien direct", desc: "Partager un lien vers l'espace." },
            { icon: "🌐", title: "Intégration web", desc: "Widget/iframe sur votre site." },
          ].map((c) => (
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
