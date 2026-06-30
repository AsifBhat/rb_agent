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
  insight?: string;
  metrics?: Array<{ label: string; value: string; tone?: "up" | "down" | "neutral" }>;
};

export type MetricItem = {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
};

export type ReportSection =
  | {
      type: "bullets";
      title: string;
      items: string[];
    }
  | {
      type: "table";
      title: string;
      columns: string[];
      rows: string[][];
    }
  | {
      type: "text";
      title: string;
      body: string;
    };

export type IntelligenceReport = {
  headline: string;
  summary: string;
  metrics: MetricItem[];
  highlights: string[];
  sections: ReportSection[];
  charts: VisualizationSpec[];
};

export type IntelligenceState =
  | { status: "idle" }
  | { status: "analyzing"; userQuery?: string; phase: "responding" | "structuring" }
  | { status: "ready"; report: IntelligenceReport; userQuery?: string; enriching?: boolean }
  | { status: "empty"; message: string };
