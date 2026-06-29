import {
  buildVisualizationFromAssistant,
  extractEmbeddedVisualization,
  normalizeVisualization,
} from "../../server/visualize-core.mjs";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "Missing OPENAI_API_KEY environment variable" }, 500);
  }

  const body = parseJson(event.body);
  const userQuery = String(body.userQuery ?? "").trim();
  const assistantText = String(body.assistantText ?? "").trim();

  if (!assistantText) {
    return json({ visualization: null });
  }

  const embedded = extractEmbeddedVisualization(assistantText);
  if (embedded) {
    return json({ visualization: normalizeVisualization(embedded) });
  }

  const apiBase = process.env.CHATKIT_API_BASE || "https://api.openai.com";

  try {
    const upstream = await fetch(`${apiBase}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: `You convert retail analytics answers into chart specifications.
Return ONLY valid JSON with this shape:
{
  "title": "string",
  "subtitle": "string optional",
  "type": "bar" | "line" | "area" | "pie",
  "data": [{ "name": "string", "value": number, "secondary": number optional }],
  "insight": "one sentence executive insight",
  "metrics": [{ "label": "string", "value": "string", "tone": "up"|"down"|"neutral" optional }]
}
Rules:
- Use 3 to 8 data points when possible.
- Prefer bar charts for comparisons, line/area for trends, pie for share breakdowns.
- Extract real numbers from the assistant answer when available; otherwise infer plausible retail demo values aligned with the narrative.
- If the content is not visualizable, return {"visualization": null}.`,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `User question:\n${userQuery}\n\nAssistant answer:\n${assistantText}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const message =
        payload?.error?.message ?? payload?.error ?? "Visualization request failed";
      return json({ error: message }, upstream.status);
    }

    const visualization = buildVisualizationFromAssistant(
      userQuery,
      assistantText,
      payload,
    );

    return json({ visualization });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Request failed" },
      502,
    );
  }
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
