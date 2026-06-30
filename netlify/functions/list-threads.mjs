const SESSION_COOKIE = "chatkit_session_id";

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "Missing OPENAI_API_KEY environment variable" }, 500);
  }

  const cookies = parseCookies(event.headers.cookie);
  const userId = cookies[SESSION_COOKIE];
  if (!userId) {
    return json({ error: "Missing session user. Refresh and try again." }, 401);
  }

  const params = event.queryStringParameters ?? {};
  const limit = params.limit ?? "5";
  const order = params.order ?? "desc";
  const apiBase = process.env.CHATKIT_API_BASE || "https://api.openai.com";

  try {
    const upstream = await fetch(
      `${apiBase}/v1/chatkit/threads?user=${encodeURIComponent(userId)}&limit=${limit}&order=${order}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Beta": "chatkit_beta=v1",
        },
      },
    );

    const payload = await upstream.json().catch(() => ({}));
    return json(payload, upstream.status);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Request failed" },
      502,
    );
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

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
