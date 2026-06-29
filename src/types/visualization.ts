export type ChartType = "bar" | "line" | "area" | "pie";

export type ChartPoint = {
  name: string;
  value: number;
  secondary?: number;
};

export type VisualizationSpec = {
  title: string;
  subtitle?: string;
  type: ChartType;
  data: ChartPoint[];
  insight: string;
  metrics?: Array<{ label: string; value: string; tone?: "up" | "down" | "neutral" }>;
};

export type IntelligenceState =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "ready"; visualization: VisualizationSpec }
  | { status: "empty"; message: string };
