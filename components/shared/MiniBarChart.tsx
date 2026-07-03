interface MiniBarChartProps {
  data: { label: string; value: number }[];
}

export function MiniBarChart({ data }: MiniBarChartProps) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--muted)", width: 110, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.label}
          </span>
          <div style={{ flex: 1, background: "var(--bg)", borderRadius: 6, height: 20, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max((d.value / max) * 100, 3)}%`,
                height: "100%",
                background: "var(--plum)",
                borderRadius: 6,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, width: 48, flex: "none", textAlign: "right" }}>
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
