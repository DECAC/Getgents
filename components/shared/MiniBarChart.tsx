interface MiniBarChartProps {
  data: { label: string; value: number }[];
}

const NUMBER_FMT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/**
 * Barres horizontales mono-série (une seule teinte : l'identité est portée
 * par le libellé, pas par la couleur). Marques fines, extrémité de donnée
 * arrondie côté valeur uniquement, valeurs en chiffres tabulaires dans
 * l'encre du texte — jamais dans la couleur de la série.
 */
export function MiniBarChart({ data }: MiniBarChartProps) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "6px 0 4px" }} role="img" aria-label="Graphique en barres">
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }} title={`${d.label} : ${NUMBER_FMT.format(d.value)}`}>
          <span
            style={{
              fontSize: 12,
              color: "var(--muted)",
              width: 120,
              flex: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "right",
            }}
          >
            {d.label}
          </span>
          <div
            style={{
              flex: 1,
              height: 14,
              borderLeft: "2px solid var(--line)",
              display: "flex",
              alignItems: "center",
              background:
                "repeating-linear-gradient(90deg, transparent 0, transparent calc(25% - 1px), var(--line-soft) calc(25% - 1px), var(--line-soft) 25%)",
            }}
          >
            <div
              style={{
                width: `${Math.max((d.value / max) * 100, 2)}%`,
                height: 12,
                background: "linear-gradient(90deg, var(--plum), color-mix(in srgb, var(--plum) 70%, var(--sage)))",
                borderRadius: "0 4px 4px 0",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              width: 64,
              flex: "none",
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              color: "var(--ink)",
            }}
          >
            {NUMBER_FMT.format(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
