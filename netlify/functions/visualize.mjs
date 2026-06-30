import {
  INTELLIGENCE_SYSTEM_PROMPT,
  buildIntelligenceFromAssistant,
  extractEmbeddedVisualization,
  fallbackReportFromText,
  normalizeIntelligenceReport,
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
    return json({ report: null });
  }

  const embedded = extractEmbeddedVisualization(assistantText);
  if (embedded) {
    return json({
      report: normalizeIntelligenceReport(embedded, assistantText),
    });
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
                text: INTELLIGENCE_SYSTEM_PROMPT,
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

    const report = buildIntelligenceFromAssistant(userQuery, assistantText, payload);

    return json({ report });
  } catch (error) {
    return json(
      {
        report: fallbackReportFromText(assistantText, userQuery),
        error: error instanceof Error ? error.message : "Request failed",
      },
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
