const CHART_TYPES = new Set(["bar", "line", "area", "pie"]);

export const INTELLIGENCE_SYSTEM_PROMPT = `You convert retail analytics answers into a CLEAN dashboard JSON. Return ONLY valid JSON.

{
  "headline": "max 8 words — the single insight",
  "summary": "max 2 short sentences",
  "metrics": [{ "label": "max 3 words", "value": "max 8 chars e.g. 36.0%", "tone": "up|down|neutral" }],
  "highlights": ["max 3 short bullets"],
  "sections": [
    { "type": "table", "title": "short title", "columns": ["col"], "rows": [["val"]] },
    { "type": "bullets", "title": "string", "items": ["string"] }
  ],
  "charts": [{ "title": "short", "subtitle": "metric name", "type": "bar", "data": [{ "name": "HP", "value": 36 }], "insight": "one sentence" }]
}

STRICT RULES:
- NO markdown (no **, no #, no |) inside any JSON string value.
- metrics: exactly 3-4 KPIs with TINY labels ("HP Share", "Avg Price") and TINY values ("36.0%", "$1,326").
- charts: ONLY when comparing 3+ entities with the SAME unit (all %, or all counts). Each data.name must be a distinct short label (brand, store, SKU) — NEVER repeat the same name.
- tables: preserve ALL rows from the source. Use separate tables for rankings vs recommendations.
- For recommendations use columns: Action, Gap, Urgency, Why Now.
- Do NOT put sentences in metrics. Do NOT duplicate the same data in metrics, charts, and tables.
- Put exhaustive detail in tables; keep headline/summary/metrics minimal.`;

export function extractEmbeddedVisualization(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = parseJson(fenced[1]);
    if (parsed?.data || parsed?.visualization?.data || parsed?.charts) {
      return parsed;
    }
  }
  return null;
}

export function extractResponseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = payload.output ?? [];
  const chunks = [];
  for (const item of output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part.type === "output_text" && part.text) chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n");
}

export function normalizeVisualization(input) {
  if (!input || typeof input !== "object") return null;

  const data = Array.isArray(input.data)
    ? input.data
        .map((point) => ({
          name: String(point.name ?? "").trim(),
          value: Number(point.value),
          secondary:
            point.secondary === undefined ? undefined : Number(point.secondary),
        }))
        .filter((point) => point.name && Number.isFinite(point.value))
    : [];

  if (!data.length) return null;

  const type = CHART_TYPES.has(input.type) ? input.type : "bar";

  return {
    title: String(input.title ?? "Retail insight").trim(),
    subtitle: input.subtitle ? String(input.subtitle).trim() : undefined,
    type,
    data,
    insight: input.insight ? String(input.insight).trim() : undefined,
    metrics: normalizeMetrics(input.metrics),
  };
}

export function normalizeMetrics(metrics) {
  if (!Array.isArray(metrics)) return [];
  return metrics
    .map((metric) => ({
      label: String(metric.label ?? "").trim(),
      value: String(metric.value ?? "").trim(),
      tone: ["up", "down", "neutral"].includes(metric.tone)
        ? metric.tone
        : "neutral",
    }))
    .filter((metric) => metric.label && metric.value);
}

export function normalizeSection(section) {
  if (!section || typeof section !== "object") return null;
  const title = String(section.title ?? "").trim();
  if (!title) return null;

  if (section.type === "bullets" && Array.isArray(section.items)) {
    const items = section.items
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    if (!items.length) return null;
    return { type: "bullets", title, items };
  }

  if (section.type === "table" && Array.isArray(section.columns)) {
    const columns = section.columns
      .map((col) => String(col ?? "").trim())
      .filter(Boolean);
    const rows = Array.isArray(section.rows)
      ? section.rows
          .map((row) =>
            Array.isArray(row)
              ? row.map((cell) => String(cell ?? "").trim())
              : [],
          )
          .filter((row) => row.some(Boolean))
      : [];
    if (!columns.length || !rows.length) return null;
    return { type: "table", title, columns, rows };
  }

  if (section.type === "text") {
    const body = String(section.body ?? "").trim();
    if (!body) return null;
    return { type: "text", title, body };
  }

  return null;
}

export function normalizeIntelligenceReport(input, assistantText = "") {
  if (!input || typeof input !== "object") {
    return fallbackReportFromText(assistantText);
  }

  const charts = Array.isArray(input.charts)
    ? input.charts.map(normalizeVisualization).filter(Boolean)
    : [];

  const legacyChart = normalizeVisualization(input);
  if (legacyChart && !charts.length) {
    charts.push(legacyChart);
  }

  const sections = Array.isArray(input.sections)
    ? input.sections.map(normalizeSection).filter(Boolean)
    : [];

  const highlights = Array.isArray(input.highlights)
    ? input.highlights.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  const metrics = normalizeMetrics(input.metrics);
  const headline = String(input.headline ?? input.title ?? "Retail analysis").trim();
  const summary = String(
    input.summary ?? input.insight ?? "Analysis synthesized from the latest response.",
  ).trim();

  const report = {
    headline,
    summary,
    metrics,
    highlights,
    sections,
    charts,
  };

  if (!report.sections.length && assistantText.trim()) {
    report.sections.push({
      type: "text",
      title: "Full analysis",
      body: assistantText.trim(),
    });
  }

  if (!report.summary && assistantText.trim()) {
    report.summary = assistantText.trim().slice(0, 600);
  }

  return compactReport(report);
}

export function compactReport(report) {
  return {
    ...report,
    metrics: (report.metrics ?? []).filter((metric) => metric.label && metric.value),
    highlights: (report.highlights ?? []).filter(Boolean),
    charts: (report.charts ?? []).filter((chart) => chart.data?.length >= 2),
    sections: (report.sections ?? []).filter(Boolean),
  };
}

export function fallbackReportFromText(assistantText, userQuery = "") {
  const text = String(assistantText ?? "").trim();
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines
    .filter((line) => /^[-*•\d]+[.)]?\s+/.test(line))
    .map((line) => line.replace(/^[-*•\d]+[.)]?\s+/, "").trim());

  const sections = [];
  if (bulletLines.length) {
    sections.push({
      type: "bullets",
      title: "Key points",
      items: bulletLines,
    });
  }
  if (text) {
    sections.push({
      type: "text",
      title: "Full analysis",
      body: text,
    });
  }

  return {
    headline: userQuery || "Retail analysis",
    summary: text.slice(0, 320) || "Waiting for analysis content.",
    metrics: [],
    highlights: bulletLines.slice(0, 8),
    sections,
    charts: [],
  };
}

export function buildVisualizationFromAssistant(userQuery, assistantText, modelPayload) {
  const embedded = extractEmbeddedVisualization(assistantText);
  if (embedded) {
    return normalizeVisualization(embedded.visualization ?? embedded);
  }

  const rawText = extractResponseText(modelPayload);
  const parsed = parseJson(rawText);
  if (parsed.visualization === null) return null;
  return normalizeVisualization(parsed.visualization ?? parsed);
}

export function buildIntelligenceFromAssistant(userQuery, assistantText, modelPayload) {
  const embedded = extractEmbeddedVisualization(assistantText);
  if (embedded) {
    return normalizeIntelligenceReport(embedded, assistantText);
  }

  const rawText = extractResponseText(modelPayload);
  const parsed = parseJson(rawText);
  if (parsed.report === null) {
    return fallbackReportFromText(assistantText, userQuery);
  }

  return normalizeIntelligenceReport(parsed.report ?? parsed, assistantText);
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
