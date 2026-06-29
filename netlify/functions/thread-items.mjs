export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "Missing OPENAI_API_KEY environment variable" }, 500);
  }

  const params = event.queryStringParameters ?? {};
  const threadId = params.threadId;
  if (!threadId) {
    return json({ error: "Missing threadId" }, 400);
  }

  const limit = params.limit ?? "30";
  const order = params.order ?? "desc";
  const apiBase = process.env.CHATKIT_API_BASE || "https://api.openai.com";

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

    const payload = await upstream.json().catch(() => ({}));
    return json(payload, upstream.status);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Request failed" },
      502,
    );
  }
}

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
