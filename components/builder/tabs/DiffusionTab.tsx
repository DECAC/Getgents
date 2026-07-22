"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import styles from "./DiffusionTab.module.css";

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DiffusionTab() {
  const { currentDraft, updateChannel } = useBuilder();
  const channel = currentDraft.channel;
  const isEmail = channel?.kind === "email";
  const to = channel?.to?.trim() ?? "";
  const toOk = isEmail ? EMAIL.test(to) : E164.test(to);

  return (
    <div className={styles.wrap}>
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

            <div className={styles.note}>
              {isEmail ? (
                <>
                  Envoi via Brevo — configurez <code> BREVO_API_KEY </code> et
                  <code> BREVO_SENDER_EMAIL </code> côté serveur (expéditeur vérifié dans Brevo).
                </>
              ) : (
                <>
                  Hors de la fenêtre de 24 h suivant un message du destinataire, Meta n&apos;autorise
                  que des messages « template » pré-approuvés. Configurez <code> WHATSAPP_TOKEN </code>
                  et <code> WHATSAPP_PHONE_NUMBER_ID </code> côté serveur.
                </>
              )}
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
