import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VisualizationSpec } from "../../types/visualization";

const COLORS = ["#0082C5", "#38BDF8", "#0EA5E9", "#06B6D4", "#14B8A6", "#6366F1"];

type ChartRendererProps = {
  spec: VisualizationSpec;
};

export function ChartRenderer({ spec }: ChartRendererProps) {
  return (
    <div className="viz-chart">
      <ResponsiveContainer width="100%" height={280}>
        {spec.type === "pie" ? (
          <PieChart>
            <Pie
              data={spec.data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={98}
              paddingAngle={3}
            >
              {spec.data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(0,130,197,0.25)",
                background: "rgba(7,16,24,0.95)",
                color: "#e2e8f0",
              }}
            />
          </PieChart>
        ) : spec.type === "line" ? (
          <LineChart data={spec.data}>
            <CartesianGrid stroke="rgba(0,130,197,0.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(0,130,197,0.25)",
                background: "rgba(7,16,24,0.95)",
                color: "#e2e8f0",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0082C5"
              strokeWidth={3}
              dot={{ r: 4, fill: "#0082C5" }}
            />
          </LineChart>
        ) : spec.type === "area" ? (
          <AreaChart data={spec.data}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0082C5" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0082C5" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,130,197,0.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(0,130,197,0.25)",
                background: "rgba(7,16,24,0.95)",
                color: "#e2e8f0",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0082C5"
              fill="url(#areaFill)"
              strokeWidth={2.5}
            />
          </AreaChart>
        ) : (
          <BarChart data={spec.data} barSize={28}>
            <CartesianGrid stroke="rgba(0,130,197,0.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(0,130,197,0.25)",
                background: "rgba(7,16,24,0.95)",
                color: "#e2e8f0",
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {spec.data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
