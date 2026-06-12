import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv, type Plugin } from "vite";

function chatkitSessionDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: "chatkit-session-dev",
    configureServer(server) {
      server.middlewares.use("/api/create-session", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const apiKey = env.OPENAI_API_KEY;
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
        const apiBase = env.CHATKIT_API_BASE || "https://api.openai.com";

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
          res.end(JSON.stringify(payload.client_secret ? { client_secret: payload.client_secret } : payload));
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
    plugins: [react(), chatkitSessionDevPlugin(env)],
    server: { port: 5173 },
  };
});
