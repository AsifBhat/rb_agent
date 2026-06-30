import { sanitizeReport } from "./sanitize";
import type { IntelligenceReport, ReportSection } from "../types/visualization";

function normalizeWhitespace(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function isDuplicateHighlight(highlight: string, summary: string): boolean {
  const norm = normalizeWhitespace(highlight);
  if (norm.length < 12) return false;
  return normalizeWhitespace(summary).includes(norm);
}

function isValidSection(section: ReportSection): boolean {
  if (section.type === "bullets") return section.items.length > 0;
  if (section.type === "table") {
    return section.columns.length > 0 && section.rows.length > 0;
  }
  return section.body.trim().length > 0;
}

export function pruneReport(report: IntelligenceReport): IntelligenceReport {
  const sanitized = sanitizeReport(report);
  const summary = sanitized.summary.trim();
  const highlights = sanitized.highlights.filter(
    (item) => item.trim() && !isDuplicateHighlight(item, summary),
  );

  return {
    ...sanitized,
    summary,
    metrics: sanitized.metrics.filter((metric) => metric.label && metric.value),
    highlights,
    charts: sanitized.charts.filter((chart) => chart.data.length >= 2),
    sections: sanitized.sections.filter(isValidSection),
  };
}
