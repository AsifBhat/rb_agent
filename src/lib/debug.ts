const PREFIX = "[RetailPulse]";

function isEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  return (
    new URLSearchParams(window.location.search).has("debug") ||
    window.localStorage.getItem("retailPulseDebug") === "1"
  );
}

export const debug = {
  log(label: string, ...args: unknown[]) {
    if (!isEnabled()) return;
    console.log(`${PREFIX} ${label}`, ...args);
  },
  warn(label: string, ...args: unknown[]) {
    if (!isEnabled()) return;
    console.warn(`${PREFIX} ${label}`, ...args);
  },
  error(label: string, ...args: unknown[]) {
    console.error(`${PREFIX} ${label}`, ...args);
  },
  group(label: string, data: unknown) {
    if (!isEnabled()) return;
    console.groupCollapsed(`${PREFIX} ${label}`);
    console.log(data);
    console.groupEnd();
  },
};

export function extractTextsDeep(value: unknown, depth = 0): string[] {
  if (depth > 8 || value == null) return [];
  const texts: string[] = [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 8) texts.push(trimmed);
    return texts;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      texts.push(...extractTextsDeep(entry, depth + 1));
    }
    return texts;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, entry] of Object.entries(record)) {
      if (
        (key === "text" || key === "output_text" || key === "summary" || key === "heading") &&
        typeof entry === "string" &&
        entry.trim()
      ) {
        texts.push(entry.trim());
      }
      texts.push(...extractTextsDeep(entry, depth + 1));
    }
  }

  return texts;
}
