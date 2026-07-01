"use client";

import { useState } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import type { EspaceTab, BudgetHistoryPoint } from "@/lib/types";
import styles from "./BudgetTab.module.css";

export function BudgetTab({ tab }: { tab: EspaceTab }) {
  const { addSpend } = useEspace();
  const [spendCat, setSpendCat] = useState(tab.categories?.[0]?.label ?? "");
  const [spendAmt, setSpendAmt] = useState("");

  const categories = tab.categories ?? [];
  const history: BudgetHistoryPoint[] = tab.history ?? [];
  const envelope = tab.envelope ?? 0;

  const spent = categories.reduce((s, c) => s + c.spent, 0);
  const pct = Math.min(100, Math.round((spent / envelope) * 1000) / 10);
  const warnLevel = pct >= 80;

  // Donut
  const ringR = 54;
  const ringC = 2 * Math.PI * ringR;
  const total = categories.reduce((s, c) => s + c.spent, 0) || 1;
  let cursor = 0;
  const segments = categories
    .filter((c) => c.spent > 0)
    .map((c) => {
      const frac = c.spent / total;
      const dash = frac * ringC;
      const seg = { color: c.color, dash, offset: cursor };
      cursor += dash;
      return seg;
    });

  // Sparkline
  const W = 600, H = 160, pad = 28;
  const maxCum = Math.max(...history.map((h) => h.cum), envelope);
  const pts = history.map((h, i) => ({
    x: pad + (i / Math.max(history.length - 1, 1)) * (W - 2 * pad),
    y: H - pad - (h.cum / maxCum) * (H - 2 * pad),
    h,
  }));
  const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = linePath + ` L${pts[pts.length - 1].x.toFixed(1)},${H - pad} L${pts[0].x.toFixed(1)},${H - pad} Z`;
  const envY = H - pad - (envelope / maxCum) * (H - 2 * pad);

  function handleAddSpend() {
    const amt = parseFloat(spendAmt);
    if (!amt || amt <= 0 || !spendCat) return;
    addSpend(spendCat, amt);
    setSpendAmt("");
  }

  return (
    <div className={styles.wrap}>
      {/* Envelope card */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h4 className={styles.cardTitle}>Enveloppe du voyage</h4>
            <div className={styles.cardSub}>
              Suivi en temps réel — mis à jour à chaque réservation confirmée ou dépense déclarée
            </div>
          </div>
          <span className={styles.liveTag}>
            <span className={styles.pulse} />
            En direct
          </span>
        </div>
        <div className={styles.envelope}>
          <span className={styles.amt}>
            {spent.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </span>
          <span className={styles.of}>/ {envelope.toLocaleString("fr-FR")} € engagés</span>
        </div>
        <div className={styles.barTrack}>
          <div
            className={[styles.barFill, warnLevel ? styles.barWarn : ""].filter(Boolean).join(" ")}
            style={{ width: `${pct}%` }}
          />
          <div className={styles.barMarker} style={{ left: "80%" }} />
        </div>
        <div className={styles.barLabels}>
          <span>0 €</span>
          <span>Seuil d&apos;alerte 80 %</span>
          <span>{envelope.toLocaleString("fr-FR")} €</span>
        </div>
        {warnLevel && (
          <div className={styles.alertWarn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{ flex: "none" }}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>Vous approchez du seuil d&apos;alerte à 80 % de l&apos;enveloppe.</span>
          </div>
        )}
      </div>

      {/* Donut card */}
      <div className={styles.card}>
        <h4 className={styles.cardTitle}>Répartition par poste</h4>
        <div className={styles.cardSub}>Hors carburant et péages, comme convenu dans la mémoire</div>
        <div className={styles.donutRow}>
          <svg viewBox="0 0 160 160" className={styles.donutSvg}>
            {segments.length === 0 ? (
              <circle cx="80" cy="80" r={ringR} fill="none" stroke="var(--line)" strokeWidth="20" />
            ) : (
              segments.map((seg, i) => (
                <circle
                  key={i}
                  cx="80"
                  cy="80"
                  r={ringR}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="20"
                  strokeDasharray={`${seg.dash.toFixed(1)} ${(ringC - seg.dash).toFixed(1)}`}
                  strokeDashoffset={(-seg.offset).toFixed(1)}
                  transform="rotate(-90 80 80)"
                />
              ))
            )}
          </svg>
          <div className={styles.legend}>
            {categories.map((c) => (
              <div key={c.label} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: c.color }} />
                {c.label}
                <span className={styles.legendVal}>
                  {c.spent.toLocaleString("fr-FR", { minimumFractionDigits: c.spent % 1 ? 2 : 0 })} €
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sparkline card */}
      <div className={styles.card}>
        <h4 className={styles.cardTitle}>Évolution du cumul engagé</h4>
        <div className={styles.cardSub}>Depuis l&apos;ouverture de l&apos;espace</div>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.sparkSvg}>
          <line
            x1={pad} y1={envY.toFixed(1)} x2={W - pad} y2={envY.toFixed(1)}
            stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="4 4"
          />
          <text x={W - pad} y={(envY - 6).toFixed(1)} textAnchor="end" fontSize="10" fill="var(--gold)" fontFamily="Inter">
            Enveloppe
          </text>
          <path d={areaPath} fill="var(--sage-tint)" opacity="0.6" />
          <path d={linePath} fill="none" stroke="var(--sage)" strokeWidth="2.5" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3.5" fill="var(--sage-700)" />
          ))}
          {pts.map((p, i) => (
            <text key={i} x={p.x.toFixed(1)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--faint)" fontFamily="Inter">
              {p.h.day}
            </text>
          ))}
        </svg>
      </div>

      {/* Spend input card */}
      <div className={styles.card}>
        <h4 className={styles.cardTitle}>Déclarer une dépense</h4>
        <div className={styles.cardSub}>
          Pour ce que l&apos;assistant ne voit pas passer (espèces, achats sur place…)
        </div>
        <div className={styles.spendInput}>
          <select
            className={styles.spendSelect}
            value={spendCat}
            onChange={(e) => setSpendCat(e.target.value)}
            aria-label="Catégorie de dépense"
          >
            {categories.map((c) => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
          <input
            className={styles.spendAmtInput}
            type="number"
            min={0}
            step={0.5}
            placeholder="Montant en €"
            value={spendAmt}
            onChange={(e) => setSpendAmt(e.target.value)}
            aria-label="Montant en euros"
          />
          <button className={styles.spendBtn} onClick={handleAddSpend}>
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
