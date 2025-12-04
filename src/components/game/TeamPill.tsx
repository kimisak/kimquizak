'use client';

type Props = {
  name?: string;
  color?: string;
  emoji?: string | null;
  label?: string;
};

export function TeamPill({ name, color = "#f2c14f", emoji = "⭐️", label }: Props) {
  if (!name) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "0.95rem" }}>
      {label && <span>{label}:</span>}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 10px",
          borderRadius: "999px",
          background: `${color}1f`,
          border: `1px solid ${color}66`,
          color: "#f8fafc",
          fontWeight: 800,
          letterSpacing: "0.01em",
          boxShadow: `0 1px 6px ${color}44`,
          whiteSpace: "nowrap",
        }}
      >
        <span>{emoji}</span>
        <span>{name}</span>
      </span>
    </span>
  );
}
