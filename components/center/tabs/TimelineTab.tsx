import type { EspaceTab } from "@/lib/types";
import styles from "./TimelineTab.module.css";

export function TimelineTab({ tab }: { tab: EspaceTab }) {
  const steps = tab.steps ?? [];
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h4 className={styles.title}>{tab.name}</h4>
        <div className={styles.sub}>{tab.sub}</div>
        <div className={styles.timeline}>
          {steps.map((step) => (
            <div key={step.day} className={[styles.step, step.status === "future" ? styles.future : ""].filter(Boolean).join(" ")}>
              <div className={styles.dot}>{step.day}</div>
              <div className={styles.city}>{step.city}</div>
              <div className={styles.night}>{step.night}</div>
              <div className={styles.tags}>
                {step.tags.map((tag) => (
                  <span key={tag} className={[styles.tag, step.status === "future" ? styles.tagPending : ""].filter(Boolean).join(" ")}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
