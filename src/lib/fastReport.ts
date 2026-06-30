import type {
  IntelligenceReport,
  MetricItem,
  ReportSection,
} from "../types/visualization";
import { cleanText } from "./sanitize";
import { buildChartFromTable, isUsefulChart } from "./dashboardModel";

function parseMarkdownTables(text: string): ReportSection[] {
  const lines = text.split("\n");
  const sections: ReportSection[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.includes("|")) {
      i += 1;
      continue;
    }

    const block: string[] = [];
    while (i < lines.length && lines[i].trim().includes("|")) {
      block.push(lines[i].trim());
      i += 1;
    }

    if (block.length < 2) continue;

    const rows = block
      .filter((row) => !/^\|?[\s-:|]+\|?$/.test(row))
      .map((row) =>
        row
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean),
      )
      .filter((row) => row.length >= 2);

    if (rows.length < 2) continue;

    const titleLine = lines[Math.max(0, i - block.length - 2)]?.trim() ?? "Data breakdown";
    const title = cleanText(titleLine).slice(0, 80) || "Data breakdown";

    sections.push({
      type: "table",
      title,
      columns: rows[0].map((cell) => cleanText(cell)),
      rows: rows.slice(1).map((row) => row.map((cell) => cleanText(cell))),
    });
  }

  return sections;
}

function extractMetrics(text: string, sections: ReportSection[]): MetricItem[] {
  const metrics: MetricItem[] = [];
  const seen = new Set<string>();

  for (const section of sections) {
    if (section.type !== "table") continue;
    for (const row of section.rows) {
      const label = cleanText(row[0] ?? "");
      const value = cleanText(row[1] ?? "");
      if (!label || !value || seen.has(label)) continue;
      if (label.length > 36 || value.length > 16) continue;
      seen.add(label);
      metrics.push({ label, value, tone: "neutral" });
    }
  }

  if (metrics.length >= 2) return metrics;

  const pattern = /([A-Za-z][\w\s/&.-]{2,30}?):\s*([0-9.,]+%?|\$?\d[\d,.]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) && metrics.length < 4) {
    const label = cleanText(match[1] ?? "");
    const value = cleanText(match[2] ?? "");
    if (!label || !value || seen.has(label)) continue;
    if (label.length > 36 || value.length > 16) continue;
    seen.add(label);
    metrics.push({ label, value, tone: "neutral" });
  }

  return metrics;
}

function extractSummary(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => cleanText(p))
    .filter((p) => p.length > 30 && !/^[-*•]/.test(p));

  const first = paragraphs[0] ?? cleanText(text);
  return first.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 220);
}

function extractHeadline(text: string, userQuery: string): string {
  const heading = text.match(/^#{1,3}\s+(.+)$/m)?.[1];
  if (heading) {
    const clean = cleanText(heading);
    if (clean.length < 80) return clean;
  }

  const bold = text.match(/\*\*([^*]{8,80})\*\*/)?.[1];
  if (bold) return cleanText(bold);

  return userQuery
    ? userQuery.charAt(0).toUpperCase() + userQuery.slice(1)
    : "Retail intelligence report";
}

function extractProseSection(text: string, usedLines: Set<string>): ReportSection | null {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => {
      if (p.length < 40) return false;
      if (p.includes("|")) return false;
      if (/^[-*•#]/.test(p)) return false;
      if (usedLines.has(p)) return false;
      return true;
    });

  if (!paragraphs.length) return null;
  return {
    type: "text",
    title: "Full response",
    body: paragraphs.map((p) => cleanText(p)).join("\n\n"),
  };
}

export function buildFastReportFromText(
  assistantText: string,
  userQuery = "",
): IntelligenceReport {
  const text = assistantText.trim();
  const tableSections = parseMarkdownTables(text);
  const usedLines = new Set<string>([extractSummary(text)]);
  const proseSection = extractProseSection(text, usedLines);

  const sections: ReportSection[] = [
    ...tableSections,
    ...(proseSection ? [proseSection] : []),
  ];

  const rankingTable = tableSections.find((table) =>
    /share|store|brand|listing|rank/i.test(
      table.columns.join(" ") + table.title,
    ),
  );
  const chartSource = rankingTable ?? tableSections[0];
  const builtChart = chartSource ? buildChartFromTable(chartSource) : null;
  const charts = builtChart && isUsefulChart(builtChart) ? [builtChart] : [];

  return {
    headline: extractHeadline(text, userQuery),
    summary: extractSummary(text),
    metrics: extractMetrics(text, tableSections),
    highlights: [],
    sections,
    charts,
  };
}

export function mergeAssistantTextSection(
  report: IntelligenceReport,
  assistantText: string,
): IntelligenceReport {
  const body = assistantText.trim();
  if (!body) return report;

  const hasFullText = report.sections.some(
    (section) => section.type === "text" && section.body.length >= body.length * 0.85,
  );
  if (hasFullText) return report;

  return {
    ...report,
    sections: [...report.sections, { type: "text", title: "Full response", body }],
  };
}

export function buildFastReportWithFullText(
  assistantText: string,
  userQuery = "",
): IntelligenceReport {
  return mergeAssistantTextSection(
    buildFastReportFromText(assistantText, userQuery),
    assistantText,
  );
}
