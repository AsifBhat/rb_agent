import { buildFastReportWithFullText, mergeAssistantTextSection } from "./fastReport";
import { pruneReport } from "./pruneReport";
import type { IntelligenceReport, ReportSection } from "../types/visualization";
import { debug } from "./debug";

type ThreadItem = {
  id?: string;
  type?: string;
  role?: string;
  text?: string;
  heading?: string;
  summary?: string;
  output?: string;
  thread_id?: string;
  content?: Array<{ type?: string; text?: string; value?: string } | string>;
};

type ThreadItemsResponse = {
  data?: ThreadItem[];
};

type ThreadsListResponse = {
  data?: Array<{ id?: string; created_at?: number }>;
  error?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function extractTextFromItem(item: ThreadItem): string {
  if (typeof item.text === "string" && item.text.trim()) {
    return item.text.trim();
  }

  if (typeof item.summary === "string" && item.summary.trim()) {
    return item.summary.trim();
  }

  if (typeof item.heading === "string" && item.heading.trim()) {
    return item.heading.trim();
  }

  if (typeof item.output === "string" && item.output.trim()) {
    return item.output.trim();
  }

  if (typeof item.content === "string" && item.content.trim()) {
    return item.content.trim();
  }

  if (!item.content?.length) return "";

  return item.content
    .map((part) => {
      if (typeof part === "string") return part;
      return part.text ?? part.value ?? "";
    })
    .join("\n")
    .trim();
}

function isUserItem(item: ThreadItem): boolean {
  const type = item.type ?? "";
  return (
    type === "chatkit.user_message" ||
    type === "user_message" ||
    item.role === "user"
  );
}

function isAssistantItem(item: ThreadItem): boolean {
  const type = item.type ?? "";
  return (
    type === "chatkit.assistant_message" ||
    type === "assistant_message" ||
    item.role === "assistant" ||
    type.includes("assistant")
  );
}

function isTaskItem(item: ThreadItem): boolean {
  const type = item.type ?? "";
  return type === "chatkit.task" || type === "task" || type.includes("task");
}

function normalizeQuery(text: string): string {
  return text.toLowerCase().replace(/[^\w\s%$.,]/g, "").replace(/\s+/g, " ").trim();
}

export function queriesMatch(actual: string, expected: string): boolean {
  const left = normalizeQuery(actual);
  const right = normalizeQuery(expected);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function getLatestMessages(items: ThreadItem[], expectedUserQuery = "") {
  const chronological = [...items];

  let lastUserIdx = -1;
  const expected = normalizeQuery(expectedUserQuery);

  if (expected) {
    for (let i = chronological.length - 1; i >= 0; i -= 1) {
      if (!isUserItem(chronological[i])) continue;
      const userText = normalizeQuery(extractTextFromItem(chronological[i]));
      if (queriesMatch(userText, expected)) {
        lastUserIdx = i;
        break;
      }
    }
  }

  if (lastUserIdx < 0) {
    for (let i = chronological.length - 1; i >= 0; i -= 1) {
      if (isUserItem(chronological[i])) {
        lastUserIdx = i;
        break;
      }
    }
  }

  const user = lastUserIdx >= 0 ? chronological[lastUserIdx] : undefined;
  const turnItems = lastUserIdx >= 0 ? chronological.slice(lastUserIdx + 1) : chronological;

  const assistantParts: string[] = [];
  for (const item of turnItems) {
    if (isAssistantItem(item)) {
      const text = extractTextFromItem(item);
      if (text) assistantParts.push(text);
      continue;
    }

    if (isTaskItem(item)) {
      const text = [item.summary, item.heading].filter(Boolean).join(": ").trim();
      if (text) assistantParts.push(text);
    }
  }

  const threadId = chronological.find((item) => item.thread_id)?.thread_id ?? null;
  const userText = user ? extractTextFromItem(user) : "";

  debug.log("parsed messages", {
    itemCount: items.length,
    itemTypes: items.map((item) => item.type),
    assistantLength: assistantParts.join("\n\n").length,
    userLength: userText.length,
    threadId,
    expectedQuery: expectedUserQuery || undefined,
    queryMatched: expected ? queriesMatch(userText, expectedUserQuery) : true,
  });

  return {
    assistantText: assistantParts.join("\n\n").trim(),
    userText,
    threadId,
  };
}

export async function fetchThreadItems(threadId: string): Promise<ThreadItem[]> {
  debug.log("fetchThreadItems →", threadId);
  const response = await fetch(
    `/api/thread-items?threadId=${encodeURIComponent(threadId)}&limit=30&order=desc`,
    { credentials: "include" },
  );
  const payload = (await response.json().catch(() => ({}))) as ThreadItemsResponse & {
    error?: string;
  };

  debug.group("thread-items response", payload);

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load thread items");
  }

  return (payload.data ?? []).slice().reverse();
}

export async function fetchLatestThreadId(): Promise<string | null> {
  debug.log("fetchLatestThreadId");
  const response = await fetch("/api/list-threads?limit=5&order=desc", {
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as ThreadsListResponse;

  debug.group("list-threads response", payload);

  if (!response.ok) {
    debug.warn("list-threads failed", payload.error ?? response.status);
    return null;
  }

  return payload.data?.[0]?.id ?? null;
}

export async function pollForAssistantMessage(
  threadId: string,
  maxAttempts = 60,
  intervalMs = 400,
  expectedUserQuery = "",
): Promise<{ assistantText: string; userText: string; threadId: string | null }> {
  let lastResult = { assistantText: "", userText: "", threadId };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    debug.log(`poll attempt ${attempt + 1}/${maxAttempts}`, threadId);
    const items = await fetchThreadItems(threadId);
    lastResult = getLatestMessages(items, expectedUserQuery);

    if (expectedUserQuery && !queriesMatch(lastResult.userText, expectedUserQuery)) {
      await sleep(intervalMs);
      continue;
    }

    if (lastResult.assistantText) {
      debug.log("assistant text found", lastResult.assistantText.slice(0, 200));
      return lastResult;
    }
    await sleep(intervalMs);
  }

  debug.warn("poll exhausted with no assistant text", threadId);
  return lastResult;
}

export async function resolveLatestAssistantResponse(
  knownThreadId: string | null,
  expectedUserQuery = "",
): Promise<{ threadId: string | null; assistantText: string; userText: string }> {
  const threadId = knownThreadId ?? (await fetchLatestThreadId());
  if (!threadId) {
    debug.warn("no thread id available");
    return { threadId: null, assistantText: "", userText: "" };
  }

  const result = await pollForAssistantMessage(threadId, 4, 350, expectedUserQuery);
  return { threadId, ...result };
}

export async function buildIntelligenceReport(
  userQuery: string,
  assistantText: string,
  timeoutMs = 18000,
): Promise<IntelligenceReport> {
  debug.log("buildIntelligenceReport", {
    query: userQuery,
    assistantPreview: assistantText.slice(0, 200),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/visualize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userQuery, assistantText }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      report?: IntelligenceReport | null;
      error?: string;
    };

    debug.group("visualize response", payload);

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to build intelligence report");
    }

    if (payload.report) {
      return pruneReport(
        mergeAssistantTextSection(payload.report, assistantText),
      );
    }

    return pruneReport(fallbackReportFromText(assistantText, userQuery));
  } finally {
    clearTimeout(timeout);
  }
}

export function fallbackReportFromText(
  assistantText: string,
  userQuery = "",
): IntelligenceReport {
  return pruneReport(buildFastReportWithFullText(assistantText, userQuery));
}
