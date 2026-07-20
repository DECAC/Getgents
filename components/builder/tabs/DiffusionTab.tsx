"use client";

import styles from "./DiffusionTab.module.css";

const CHANNELS = [
  {
    icon: "🔗",
    title: "Lien direct",
    desc: "Un lien vers l'espace utilisateur, à partager comme vous le souhaitez.",
  },
  {
    icon: "🌐",
    title: "Intégration web",
    desc: "Un widget ou une iframe à intégrer sur votre propre site.",
  },
  {
    icon: "💬",
    title: "Canaux de messagerie",
    desc: "Slack, WhatsApp, e-mail… pour joindre le gent depuis les outils déjà utilisés.",
  },
];

export function DiffusionTab() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h4 className={styles.title}>Diffusion</h4>
        <div className={styles.sub}>
          Choisissez où et comment ce gent est accessible une fois publié — cette section arrive
          bientôt.
        </div>
        <div className={styles.channels}>
          {CHANNELS.map((c) => (
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
