interface ChecklistViewProps {
  items: { label: string; checked: boolean }[];
  onToggle: (index: number) => void;
}

export function ChecklistView({ items, onToggle }: ChecklistViewProps) {
  if (!items.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
      {items.map((item, i) => (
        <label
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "8px 10px",
            borderRadius: 8,
            background: "var(--bg)",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={item.checked}
            onChange={() => onToggle(i)}
            style={{ width: 16, height: 16, flex: "none", accentColor: "var(--plum)" }}
          />
          <span
            style={{
              textDecoration: item.checked ? "line-through" : "none",
              color: item.checked ? "var(--faint)" : "var(--ink)",
            }}
          >
            {item.label}
          </span>
        </label>
      ))}
    </div>
  );
}
