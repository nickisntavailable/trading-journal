export function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "long" | "short" | "neutral";
}) {
  const color =
    tone === "long" ? "text-long" : tone === "short" ? "text-short" : "text-ink";
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className={`num mt-0.5 truncate text-[16px] ${color}`}>{value}</p>
    </div>
  );
}
