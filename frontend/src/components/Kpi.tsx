interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "pos" | "neg" | "neutral";
  format?: "pct" | "money" | "num" | "raw";
}

function fmt(v: string | number, format?: KpiProps["format"]) {
  if (typeof v === "string") return v;
  if (format === "pct") return `${v.toFixed(2)}%`;
  if (format === "money") return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (format === "num") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
}

export default function Kpi({ label, value, sub, tone = "neutral", format }: KpiProps) {
  const cls = tone === "pos" ? "value pos" : tone === "neg" ? "value neg" : "value";
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={cls}>{fmt(value, format)}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
