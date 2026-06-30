import { cleanText, isDisplayableKpi } from "./sanitize";
import type {
  IntelligenceReport,
  MetricItem,
  ReportSection,
  VisualizationSpec,
} from "../types/visualization";

export type RecommendationCard = {
  title: string;
  gap: string;
  urgency: string;
  urgencyTone: "high" | "medium" | "low";
  why: string;
};

export type DashboardView = {
  headline: string;
  summary: string;
  kpis: MetricItem[];
  chart: VisualizationSpec | null;
  /** All analysis tables — shown expanded in the dashboard */
  tables: Extract<ReportSection, { type: "table" }>[];
  recommendations: RecommendationCard[] | null;
  takeaways: string[];
  /** Raw LLM transcript — only this is collapsed */
  sourceTranscript: string | null;
};

function isTable(
  section: ReportSection,
): section is Extract<ReportSection, { type: "table" }> {
  return section.type === "table";
}

function columnMatch(columns: string[], pattern: RegExp): number {
  return columns.findIndex((col) => pattern.test(cleanText(col).toLowerCase()));
}

function isRecommendationsTable(table: Extract<ReportSection, { type: "table" }>): boolean {
  const cols = table.columns.map((c) => cleanText(c).toLowerCase());
  return cols.some((c) => /action|urgency|recommend/.test(c));
}

function isRankingTable(table: Extract<ReportSection, { type: "table" }>): boolean {
  const haystack = `${table.title} ${table.columns.join(" ")}`.toLowerCase();
  return /share|rank|store|brand|listing|proportion|retailer|sku|competitor|gap/.test(haystack);
}

export function buildChartFromMetrics(metrics: MetricItem[]): VisualizationSpec | null {
  const data = metrics
    .map((metric) => {
      const value = numericFromCell(metric.value);
      if (value === null) return null;
      let name = cleanText(metric.label)
        .replace(/\b(share|skus?|sku|rating|price|avg|average|listings?)\b/gi, "")
        .trim();
      if (!name) name = cleanText(metric.label).slice(0, 16);
      return { name: name.slice(0, 16), value };
    })
    .filter((point): point is { name: string; value: number } => Boolean(point));

  if (data.length < 2 || new Set(data.map((point) => point.name)).size < 2) {
    return null;
  }

  const leader = data.reduce((a, b) => (b.value > a.value ? b : a));
  const isPercent = metrics.some((m) => m.value.includes("%"));

  return {
    title: "Competitive landscape",
    subtitle: isPercent ? "Market share" : "Head-to-head comparison",
    type: "bar",
    data,
    insight: `${leader.name} leads at ${leader.value}${isPercent ? "%" : ""}`,
  };
}

function parseRecommendations(
  table: Extract<ReportSection, { type: "table" }>,
): RecommendationCard[] {
  const titleCol = columnMatch(table.columns, /action|title|recommend/);
  const gapCol = columnMatch(table.columns, /gap/);
  const urgencyCol = columnMatch(table.columns, /urgency/);
  const whyCol = columnMatch(table.columns, /why|reason/);

  return table.rows.map((row) => {
    const urgency = urgencyCol >= 0 ? cleanText(row[urgencyCol] ?? "") : "";
    const urgencyTone: RecommendationCard["urgencyTone"] = /immediate|high|critical|urgent/i.test(
      urgency,
    )
      ? "high"
      : /moderate|medium/i.test(urgency)
        ? "medium"
        : "low";

    return {
      title: cleanText(row[titleCol >= 0 ? titleCol : 0] ?? "Action"),
      gap: gapCol >= 0 ? cleanText(row[gapCol] ?? "") : "",
      urgency,
      urgencyTone,
      why: whyCol >= 0 ? cleanText(row[whyCol] ?? "") : "",
    };
  });
}

function numericFromCell(value: string): number | null {
  const cleaned = cleanText(value).replace(/,/g, "");
  const pct = cleaned.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (pct) return Number(pct[1]);
  const num = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!num) return null;
  const n = Number(num[0]);
  return Number.isFinite(n) ? n : null;
}

export function buildChartFromTable(
  table: Extract<ReportSection, { type: "table" }>,
): VisualizationSpec | null {
  const labelCandidates = [
    columnMatch(table.columns, /brand|store|retailer|name|sku|product/),
    columnMatch(table.columns, /finding|signal/),
    0,
  ].filter((idx, i, arr) => idx >= 0 && arr.indexOf(idx) === i);

  let valueCol = columnMatch(table.columns, /share|percent|proportion/);
  if (valueCol < 0) {
    valueCol = table.columns.findIndex(
      (col, idx) =>
        idx > 0 &&
        table.rows.every((row) => numericFromCell(row[idx] ?? "") !== null) &&
        /metric|count|listing|value|price|rank/i.test(cleanText(col).toLowerCase()),
    );
  }
  if (valueCol < 0) {
    valueCol = table.columns.findIndex((_, idx) =>
      idx > 0 && table.rows.every((row) => numericFromCell(row[idx] ?? "") !== null),
    );
  }
  if (valueCol < 0) return null;

  for (const labelCol of labelCandidates) {
    const data = table.rows
      .map((row, index) => {
        let name = cleanText(row[labelCol] ?? "");
        if (!name || table.rows.filter((r) => cleanText(r[labelCol] ?? "") === name).length > 1) {
          const alt = cleanText(row[1] ?? row[2] ?? "");
          name = alt ? alt.slice(0, 22) : `Item ${index + 1}`;
        }
        const value = numericFromCell(row[valueCol] ?? "");
        if (value === null) return null;
        return { name: name.slice(0, 22), value };
      })
      .filter((point): point is { name: string; value: number } => Boolean(point));

    const uniqueNames = new Set(data.map((d) => d.name));
    if (data.length < 2 || uniqueNames.size < 2) continue;

    const values = data.map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values.filter((v) => v > 0));
    if (max > 0 && min > 0 && max / min > 500) continue;

    const leader = data.reduce((a, b) => (b.value > a.value ? b : a));
    const valueLabel = cleanText(table.columns[valueCol] ?? "Value");
    return {
      title: cleanText(table.title) || "Comparison",
      subtitle: valueLabel,
      type: "bar",
      data: data.slice(0, 8),
      insight: `Top: ${leader.name} (${leader.value}${valueLabel.includes("%") ? "%" : ""})`,
    };
  }

  return null;
}

export function isUsefulChart(chart: VisualizationSpec): boolean {
  const names = chart.data.map((d) => d.name);
  if (new Set(names).size < 2) return false;
  if (names.some((n) => n.length > 24)) return false;
  const values = chart.data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values.filter((v) => v > 0));
  if (max > 0 && min > 0 && max / min > 500) return false;
  return true;
}

function pickKpis(report: IntelligenceReport): MetricItem[] {
  const fromMetrics = report.metrics.filter(isDisplayableKpi).slice(0, 4);
  if (fromMetrics.length >= 2) return fromMetrics;

  const tables = report.sections.filter(isTable);
  const derived: MetricItem[] = [];
  for (const table of tables) {
    if (!isRankingTable(table)) continue;
    const shareCol = columnMatch(table.columns, /share|percent/);
    const nameCol = columnMatch(table.columns, /brand|store|retailer|name/);
    if (shareCol < 0 || nameCol < 0) continue;
    for (const row of table.rows.slice(0, 4)) {
      const label = cleanText(row[nameCol] ?? "");
      const value = cleanText(row[shareCol] ?? "");
      const candidate = { label, value, tone: "neutral" as const };
      if (isDisplayableKpi(candidate)) derived.push(candidate);
    }
    if (derived.length >= 2) break;
  }

  return derived.length > fromMetrics.length ? derived.slice(0, 4) : fromMetrics;
}

function shortenSummary(summary: string): string {
  const clean = cleanText(summary);
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(" ").slice(0, 220);
}

function pickPrimaryTable(
  tables: Extract<ReportSection, { type: "table" }>[],
): Extract<ReportSection, { type: "table" }> | null {
  if (!tables.length) return null;
  const ranking = tables.find(isRankingTable);
  return ranking ?? tables.sort((a, b) => b.rows.length - a.rows.length)[0];
}

export function buildDashboardView(report: IntelligenceReport): DashboardView {
  const tables = report.sections.filter(isTable);
  const recTable = tables.find(isRecommendationsTable);
  const recommendations = recTable ? parseRecommendations(recTable) : null;
  const analysisTables = tables.filter((t) => !isRecommendationsTable(t));

  const reportChart = report.charts.find(isUsefulChart) ?? null;
  const rankingTable = analysisTables.find(isRankingTable);
  const chart =
    reportChart ??
    (rankingTable ? buildChartFromTable(rankingTable) : null) ??
    analysisTables.map(buildChartFromTable).find(isUsefulChart) ??
    null;

  let finalChart = chart && isUsefulChart(chart) ? chart : null;

  if (!finalChart) {
    const kpiChart = buildChartFromMetrics(pickKpis(report));
    if (kpiChart && isUsefulChart(kpiChart)) {
      finalChart = kpiChart;
    }
  }

  const takeaways = report.highlights
    .map(cleanText)
    .filter((t) => t.length > 12 && t.length < 140)
    .slice(0, 5);

  const textSection = report.sections.find(
    (s) => s.type === "text" && s.title === "Full response",
  );
  const sourceTranscript =
    textSection?.type === "text"
      ? textSection.body
      : report.sections
          .filter((s) => s.type === "text")
          .map((s) => (s.type === "text" ? s.body : ""))
          .join("\n\n")
          .trim() || null;

  return {
    headline: cleanText(report.headline),
    summary: shortenSummary(report.summary),
    kpis: pickKpis(report),
    chart: finalChart,
    tables: analysisTables,
    recommendations,
    takeaways,
    sourceTranscript: sourceTranscript && sourceTranscript.length > 120 ? sourceTranscript : null,
  };
}
