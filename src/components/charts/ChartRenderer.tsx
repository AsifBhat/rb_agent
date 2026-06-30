import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VisualizationSpec } from "../../types/visualization";

const COLORS = [
  { fill: "url(#barGrad0)", stroke: "#0082C5" },
  { fill: "url(#barGrad1)", stroke: "#0EA5E9" },
  { fill: "url(#barGrad2)", stroke: "#06B6D4" },
  { fill: "url(#barGrad3)", stroke: "#14B8A6" },
  { fill: "url(#barGrad4)", stroke: "#6366F1" },
  { fill: "url(#barGrad5)", stroke: "#38BDF8" },
];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #c5e0f2",
  background: "#ffffff",
  color: "#0c1923",
  boxShadow: "0 12px 32px rgba(12, 25, 35, 0.12)",
  fontSize: 13,
  padding: "10px 12px",
};

type ChartRendererProps = {
  spec: VisualizationSpec;
  compact?: boolean;
};

function ChartGradients() {
  const stops = [
    ["#0082C5", "#38BDF8"],
    ["#0EA5E9", "#67E8F9"],
    ["#06B6D4", "#5EEAD4"],
    ["#14B8A6", "#6EE7B7"],
    ["#6366F1", "#A5B4FC"],
    ["#0284C7", "#7DD3FC"],
  ];

  return (
    <defs>
      {stops.map(([from, to], index) => (
        <linearGradient key={index} id={`barGrad${index}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      ))}
    </defs>
  );
}

export function ChartRenderer({ spec, compact = false }: ChartRendererProps) {
  const maxValue = Math.max(...spec.data.map((point) => point.value), 1);
  const useHorizontal =
    !compact &&
    (spec.data.some((point) => point.name.length > 14) || spec.data.length > 4);

  const chartHeight = compact
    ? Math.max(160, spec.data.length * 44)
    : useHorizontal
      ? Math.max(240, spec.data.length * 56)
      : 220;

  return (
    <div className="viz-chart viz-chart--premium" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        {useHorizontal ? (
          <BarChart
            data={spec.data}
            layout="vertical"
            margin={{ top: 8, right: 36, left: 4, bottom: 8 }}
            barCategoryGap="22%"
          >
            <ChartGradients />
            <CartesianGrid stroke="#e8f1f7" horizontal={false} strokeDasharray="4 4" />
            <XAxis
              type="number"
              domain={[0, Math.ceil(maxValue * 1.15)]}
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={128}
              tick={{ fontSize: 12, fill: "#0f172a", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), "Value"]}
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(0, 130, 197, 0.06)" }}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={26} animationDuration={900} animationEasing="ease-out">
              {spec.data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[index % COLORS.length].fill}
                  stroke={COLORS[index % COLORS.length].stroke}
                  strokeWidth={1}
                />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                fill="#0f172a"
                fontSize={12}
                fontWeight={700}
              />
            </Bar>
          </BarChart>
        ) : (
          <BarChart data={spec.data} margin={{ top: 16, right: 12, left: 0, bottom: 4 }} barCategoryGap="18%">
            <ChartGradients />
            <CartesianGrid stroke="#e8f1f7" vertical={false} strokeDasharray="4 4" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={spec.data.length > 3 ? -16 : 0}
              textAnchor={spec.data.length > 3 ? "end" : "middle"}
              height={spec.data.length > 3 ? 52 : 36}
            />
            <YAxis
              domain={[0, Math.ceil(maxValue * 1.15)]}
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), "Value"]}
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(0, 130, 197, 0.06)" }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56} animationDuration={900} animationEasing="ease-out">
              {spec.data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[index % COLORS.length].fill}
                  stroke={COLORS[index % COLORS.length].stroke}
                  strokeWidth={1}
                />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                fill="#0f172a"
                fontSize={12}
                fontWeight={700}
                offset={8}
              />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
