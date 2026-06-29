import type { VisualizationSpec } from "../types/visualization";

type ThreadItem = {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
};

type ThreadItemsResponse = {
  data?: ThreadItem[];
};

export function extractTextFromItem(item: ThreadItem): string {
  if (!item.content?.length) return "";
  return item.content
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

export function getLatestMessages(items: ThreadItem[]) {
  const reversed = [...items].reverse();
  const assistant = reversed.find((item) => item.type === "chatkit.assistant_message");
  const user = reversed.find((item) => item.type === "chatkit.user_message");
  return {
    assistantText: assistant ? extractTextFromItem(assistant) : "",
    userText: user ? extractTextFromItem(user) : "",
  };
}

export async function fetchThreadItems(threadId: string): Promise<ThreadItem[]> {
  const response = await fetch(
    `/api/thread-items?threadId=${encodeURIComponent(threadId)}&limit=30&order=desc`,
  );
  const payload = (await response.json().catch(() => ({}))) as ThreadItemsResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load thread items");
  }

  return (payload.data ?? []).slice().reverse();
}

export async function buildVisualization(
  userQuery: string,
  assistantText: string,
): Promise<VisualizationSpec | null> {
  const response = await fetch("/api/visualize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userQuery, assistantText }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    visualization?: VisualizationSpec | null;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to build visualization");
  }

  return payload.visualization ?? null;
}

export function wantsVisualization(query: string, assistantText: string): boolean {
  const text = `${query} ${assistantText}`.toLowerCase();
  const chartIntent = ["chart", "graph", "plot", "visual", "draw", "show me"].some(
    (word) => text.includes(word),
  );
  const hasNumbers = /\d/.test(assistantText);
  const hasRetailContext = [
    "price",
    "sku",
    "visibility",
    "availability",
    "portfolio",
    "retail",
    "brand",
    "compare",
    "%",
  ].some((word) => text.includes(word));

  return hasNumbers && (chartIntent || hasRetailContext);
}
