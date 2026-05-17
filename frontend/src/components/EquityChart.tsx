import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  data: { t: string; equity: number; price?: number }[];
  height?: number;
  showPrice?: boolean;
  initialCapital?: number;
}

function shortTime(t: string) {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export default function EquityChart({
  data,
  height = 280,
  showPrice = false,
  initialCapital,
}: Props) {
  if (!data || data.length === 0) {
    return <div className="help">No equity data yet — start trading or run a backtest.</div>;
  }
  const startEquity = initialCapital ?? data[0].equity;
  const ending = data[data.length - 1].equity;
  const stroke = ending >= startEquity ? "#36d399" : "#f87171";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#233066" strokeDasharray="3 4" />
        <XAxis
          dataKey="t"
          tickFormatter={shortTime}
          stroke="#8a98c3"
          minTickGap={40}
          fontSize={11}
        />
        <YAxis
          stroke="#8a98c3"
          fontSize={11}
          domain={["auto", "auto"]}
          tickFormatter={(v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <Tooltip
          contentStyle={{
            background: "#161e3a",
            border: "1px solid #233066",
            borderRadius: 8,
          }}
          labelFormatter={(l) => new Date(l).toLocaleString()}
          formatter={(v: number, name: string) =>
            name === "price"
              ? [`$${v.toFixed(2)}`, "Price"]
              : [`$${v.toFixed(2)}`, "Equity"]
          }
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={stroke}
          fill="url(#eqFill)"
          strokeWidth={2}
          isAnimationActive={false}
        />
        {showPrice && (
          <Line
            type="monotone"
            dataKey="price"
            stroke="#6c8cff"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            yAxisId={0}
          />
        )}
        <Legend wrapperStyle={{ color: "#8a98c3", fontSize: 11 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface PriceChartProps {
  data: { t: string; close: number }[];
  height?: number;
}
export function PriceChart({ data, height = 220 }: PriceChartProps) {
  if (!data || data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid stroke="#233066" strokeDasharray="3 4" />
        <XAxis
          dataKey="t"
          tickFormatter={shortTime}
          stroke="#8a98c3"
          minTickGap={40}
          fontSize={11}
        />
        <YAxis stroke="#8a98c3" fontSize={11} domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{
            background: "#161e3a",
            border: "1px solid #233066",
            borderRadius: 8,
          }}
          labelFormatter={(l) => new Date(l).toLocaleString()}
          formatter={(v: number) => [`$${v.toFixed(2)}`, "Close"]}
        />
        <Line
          type="monotone"
          dataKey="close"
          stroke="#6c8cff"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
