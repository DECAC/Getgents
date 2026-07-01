"use client";

import { useState } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import type { EspaceTab, BudgetHistoryPoint } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="mx-auto max-w-[680px]">
      {/* Envelope card */}
      <Card className="mb-4 p-[18px]">
        <div className="flex items-start gap-2.5">
          <div>
            <h4 className="m-0 mb-[3px] font-display text-[15px] tracking-tight">Enveloppe du voyage</h4>
            <div className="mb-3.5 text-xs text-muted-foreground">
              Suivi en temps réel — mis à jour à chaque réservation confirmée ou dépense déclarée
            </div>
          </div>
          <span className="ml-auto flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-tint px-2 py-[3px] text-[10px] font-semibold text-primary-hover">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            En direct
          </span>
        </div>
        <div className="mb-2.5 flex items-baseline gap-2">
          <span className="font-display text-[26px] font-bold tracking-tight">
            {spent.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </span>
          <span className="text-[13px] text-muted-foreground">/ {envelope.toLocaleString("fr-FR")} € engagés</span>
        </div>
        <div className="relative h-3.5 overflow-hidden rounded-lg bg-background">
          <div
            className={cn(
              "h-full rounded-lg bg-gradient-to-r from-primary to-primary-hover transition-[width] duration-500",
              warnLevel && "from-secondary-foreground to-[#b5862a]"
            )}
            style={{ width: `${pct}%` }}
          />
          <div className="absolute -top-1 h-[22px] w-0.5 bg-foreground opacity-35" style={{ left: "80%" }} />
        </div>
        <div className="mt-[5px] flex justify-between text-[10.5px] text-faint">
          <span>0 €</span>
          <span>Seuil d&apos;alerte 80 %</span>
          <span>{envelope.toLocaleString("fr-FR")} €</span>
        </div>
        {warnLevel && (
          <div className="mt-2.5 flex items-center gap-[7px] text-xs text-secondary-foreground">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" className="flex-none">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>Vous approchez du seuil d&apos;alerte à 80 % de l&apos;enveloppe.</span>
          </div>
        )}
      </Card>

      {/* Donut card */}
      <Card className="mb-4 p-[18px]">
        <h4 className="m-0 mb-[3px] font-display text-[15px] tracking-tight">Répartition par poste</h4>
        <div className="mb-3.5 text-xs text-muted-foreground">Hors carburant et péages, comme convenu dans la mémoire</div>
        <div className="flex flex-wrap items-center gap-6">
          <svg viewBox="0 0 160 160" className="h-[150px] w-[150px] flex-none">
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
          <div className="flex min-w-[160px] flex-1 flex-wrap gap-3.5">
            {categories.map((c) => (
              <div key={c.label} className="flex items-center gap-[7px] text-xs">
                <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: c.color }} />
                {c.label}
                <span className="ml-[3px] font-semibold">
                  {c.spent.toLocaleString("fr-FR", { minimumFractionDigits: c.spent % 1 ? 2 : 0 })} €
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Sparkline card */}
      <Card className="mb-4 p-[18px]">
        <h4 className="m-0 mb-[3px] font-display text-[15px] tracking-tight">Évolution du cumul engagé</h4>
        <div className="mb-3.5 text-xs text-muted-foreground">Depuis l&apos;ouverture de l&apos;espace</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
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
      </Card>

      {/* Spend input card */}
      <Card className="mb-4 p-[18px]">
        <h4 className="m-0 mb-[3px] font-display text-[15px] tracking-tight">Déclarer une dépense</h4>
        <div className="mb-3.5 text-xs text-muted-foreground">
          Pour ce que l&apos;assistant ne voit pas passer (espèces, achats sur place…)
        </div>
        <div className="flex gap-2 border-t border-muted pt-3.5">
          <select
            className="flex-[1.1] rounded-md border border-border bg-background px-2.5 py-[7px] text-[12.5px] text-foreground"
            value={spendCat}
            onChange={(e) => setSpendCat(e.target.value)}
            aria-label="Catégorie de dépense"
          >
            {categories.map((c) => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
          <Input
            className="flex-1 h-auto py-[7px] text-[12.5px]"
            type="number"
            min={0}
            step={0.5}
            placeholder="Montant en €"
            value={spendAmt}
            onChange={(e) => setSpendAmt(e.target.value)}
            aria-label="Montant en euros"
          />
          <Button className="flex-none" onClick={handleAddSpend}>
            Ajouter
          </Button>
        </div>
      </Card>
    </div>
  );
}
