const SESSION_COOKIE = "chatkit_session_id";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "Missing OPENAI_API_KEY environment variable" }, 500);
  }

  const workflowId =
    process.env.CHATKIT_WORKFLOW_ID ||
    process.env.VITE_CHATKIT_WORKFLOW_ID ||
    parseWorkflowId(event.body);

  if (!workflowId) {
    return json({ error: "Missing workflow id" }, 400);
  }

  const cookies = parseCookies(event.headers.cookie);
  const existingUser = cookies[SESSION_COOKIE];
  const userId = existingUser || crypto.randomUUID();
  const setCookie = !existingUser;

  const apiBase = process.env.CHATKIT_API_BASE || "https://api.openai.com";

  let upstream;
  try {
    upstream = await fetch(`${apiBase}/v1/chatkit/sessions`, {
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
  } catch (error) {
    return json(
      { error: `Failed to reach ChatKit API: ${error.message}` },
      502,
      setCookie ? cookieHeader(userId) : undefined,
    );
  }

  const payload = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    const message =
      payload?.error?.message ||
      payload?.error ||
      upstream.statusText ||
      "Failed to create session";
    return json(
      { error: message },
      upstream.status,
      setCookie ? cookieHeader(userId) : undefined,
    );
  }

  if (!payload.client_secret) {
    return json({ error: "Missing client secret in response" }, 502);
  }

  return json(
    {
      client_secret: payload.client_secret,
      expires_after: payload.expires_after ?? null,
    },
    200,
    setCookie ? cookieHeader(userId) : undefined,
  );
}

function parseWorkflowId(body) {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    return parsed?.workflow?.id || parsed?.workflowId || null;
  } catch {
    return null;
  }
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function cookieHeader(userId) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

function json(body, statusCode = 200, setCookie) {
  const headers = { "Content-Type": "application/json" };
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return { statusCode, headers, body: JSON.stringify(body) };
}
