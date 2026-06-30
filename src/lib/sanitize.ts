import type {
  IntelligenceReport,
  MetricItem,
  ReportSection,
  VisualizationSpec,
} from "../types/visualization";

/** Strip markdown and noise from display text. */
export function cleanText(text: string): string {
  return String(text ?? "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^[📊✅🔍⚠️💡]\s*/gu, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDisplayableKpi(metric: MetricItem): boolean {
  const label = cleanText(metric.label);
  const value = cleanText(metric.value);
  if (!label || !value) return false;
  if (label.length > 36 || value.length > 16) return false;
  if (/[|]{2,}|\.{3}/.test(label + value)) return false;
  if (/\b(should|recommend|increase|decrease|focus|action)\b/i.test(label)) return false;
  return true;
}

export function sanitizeMetric(metric: MetricItem): MetricItem {
  return {
    ...metric,
    label: cleanText(metric.label),
    value: cleanText(metric.value),
  };
}

export function sanitizeTable(
  section: Extract<ReportSection, { type: "table" }>,
): Extract<ReportSection, { type: "table" }> {
  return {
    ...section,
    title: cleanText(section.title),
    columns: section.columns.map((col) => cleanText(col)),
    rows: section.rows.map((row) => row.map((cell) => cleanText(cell))),
  };
}

export function sanitizeSection(section: ReportSection): ReportSection {
  if (section.type === "table") return sanitizeTable(section);
  if (section.type === "bullets") {
    return {
      ...section,
      title: cleanText(section.title),
      items: section.items.map((item) => cleanText(item)),
    };
  }
  return {
    ...section,
    title: cleanText(section.title),
    body: section.body
      .split("\n")
      .map((line) => cleanText(line))
      .join("\n")
      .trim(),
  };
}

export function sanitizeChart(chart: VisualizationSpec): VisualizationSpec {
  return {
    ...chart,
    title: cleanText(chart.title),
    subtitle: chart.subtitle ? cleanText(chart.subtitle) : undefined,
    insight: chart.insight ? cleanText(chart.insight) : undefined,
    data: chart.data.map((point) => ({
      ...point,
      name: cleanText(point.name).slice(0, 22),
    })),
  };
}

export function sanitizeReport(report: IntelligenceReport): IntelligenceReport {
  return {
    headline: cleanText(report.headline),
    summary: cleanText(report.summary),
    metrics: report.metrics.map(sanitizeMetric),
    highlights: report.highlights.map(cleanText).filter(Boolean),
    sections: report.sections.map(sanitizeSection),
    charts: report.charts.map(sanitizeChart),
  };
}
