const CHART_TYPES = new Set(["bar", "line", "area", "pie"]);

export function extractEmbeddedVisualization(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = parseJson(fenced[1]);
    if (parsed?.data || parsed?.visualization?.data) {
      return parsed.visualization ?? parsed;
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
    insight: String(input.insight ?? "Key patterns identified in the response.").trim(),
    metrics: Array.isArray(input.metrics)
      ? input.metrics
          .map((metric) => ({
            label: String(metric.label ?? "").trim(),
            value: String(metric.value ?? "").trim(),
            tone: ["up", "down", "neutral"].includes(metric.tone)
              ? metric.tone
              : "neutral",
          }))
          .filter((metric) => metric.label && metric.value)
      : undefined,
  };
}

export function buildVisualizationFromAssistant(userQuery, assistantText, modelPayload) {
  const embedded = extractEmbeddedVisualization(assistantText);
  if (embedded) {
    return normalizeVisualization(embedded);
  }

  const rawText = extractResponseText(modelPayload);
  const parsed = parseJson(rawText);
  if (parsed.visualization === null) return null;
  return normalizeVisualization(parsed.visualization ?? parsed);
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
