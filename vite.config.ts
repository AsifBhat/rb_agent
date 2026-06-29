import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv, type Plugin } from "vite";
import {
  buildVisualizationFromAssistant,
  extractEmbeddedVisualization,
  normalizeVisualization,
} from "./server/visualize-core.mjs";

const SYSTEM_PROMPT = `You convert retail analytics answers into chart specifications.
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
- If the content is not visualizable, return {"visualization": null}.`;

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function chatkitDevPlugin(env: Record<string, string>): Plugin {
  const apiBase = env.CHATKIT_API_BASE || "https://api.openai.com";
  const apiKey = env.OPENAI_API_KEY;

  return {
    name: "chatkit-dev-apis",
    configureServer(server) {
      server.middlewares.use("/api/create-session", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const workflowId = env.VITE_CHATKIT_WORKFLOW_ID;
        if (!apiKey || !workflowId) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: "Set OPENAI_API_KEY and VITE_CHATKIT_WORKFLOW_ID in .env",
            }),
          );
          return;
        }

        const userId = crypto.randomUUID();

        try {
          const upstream = await fetch(`${apiBase}/v1/chatkit/sessions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "OpenAI-Beta": "chatkit_beta=v1",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              workflow: { id: workflowId },
              user: userId,
            }),
          });

          const payload = await upstream.json();
          res.statusCode = upstream.status;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify(
              payload.client_secret ? { client_secret: payload.client_secret } : payload,
            ),
          );
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Request failed",
            }),
          );
        }
      });

      server.middlewares.use("/api/thread-items", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        if (!apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Missing OPENAI_API_KEY" }));
          return;
        }

        const url = new URL(req.url ?? "", "http://localhost");
        const threadId = url.searchParams.get("threadId");
        if (!threadId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Missing threadId" }));
          return;
        }

        const limit = url.searchParams.get("limit") ?? "30";
        const order = url.searchParams.get("order") ?? "desc";

        try {
          const upstream = await fetch(
            `${apiBase}/v1/chatkit/threads/${encodeURIComponent(threadId)}/items?limit=${limit}&order=${order}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "OpenAI-Beta": "chatkit_beta=v1",
              },
            },
          );
          const payload = await upstream.json();
          res.statusCode = upstream.status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Request failed",
            }),
          );
        }
      });

      server.middlewares.use("/api/visualize", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        if (!apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Missing OPENAI_API_KEY" }));
          return;
        }

        const body = await readBody(req);
        const parsed = JSON.parse(body || "{}") as {
          userQuery?: string;
          assistantText?: string;
        };
        const userQuery = String(parsed.userQuery ?? "").trim();
        const assistantText = String(parsed.assistantText ?? "").trim();

        if (!assistantText) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ visualization: null }));
          return;
        }

        const embedded = extractEmbeddedVisualization(assistantText);
        if (embedded) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ visualization: normalizeVisualization(embedded) }));
          return;
        }

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
                  content: [{ type: "input_text", text: SYSTEM_PROMPT }],
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
              text: { format: { type: "json_object" } },
            }),
          });

          const payload = await upstream.json();
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
            return;
          }

          const visualization = buildVisualizationFromAssistant(
            userQuery,
            assistantText,
            payload,
          );

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ visualization }));
        } catch (error) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Request failed",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), chatkitDevPlugin(env)],
    server: { port: 5173 },
  };
});
