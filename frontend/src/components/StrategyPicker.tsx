import { StrategyInfo } from "../api";

interface Props {
  strategies: StrategyInfo[];
  selected: string;
  params: Record<string, number>;
  onChangeStrategy: (key: string) => void;
  onChangeParam: (name: string, value: number) => void;
}

export default function StrategyPicker({
  strategies,
  selected,
  params,
  onChangeStrategy,
  onChangeParam,
}: Props) {
  const current = strategies.find((s) => s.key === selected);
  return (
    <div>
      <div className="field">
        <label>Model</label>
        <select value={selected} onChange={(e) => onChangeStrategy(e.target.value)}>
          {strategies.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
        {current && <div className="help">{current.description}</div>}
      </div>
      {current?.params.map((p) => {
        const val = params[p.name] ?? p.default;
        return (
          <div className="field" key={p.name}>
            <label>
              {p.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({p.description})</span>
            </label>
            <input
              type="number"
              value={val}
              min={p.min}
              max={p.max}
              step={p.type === "int" ? 1 : 0.1}
              onChange={(e) =>
                onChangeParam(p.name, p.type === "int" ? parseInt(e.target.value || "0", 10) : parseFloat(e.target.value || "0"))
              }
            />
          </div>
        );
      })}
    </div>
  );
}
