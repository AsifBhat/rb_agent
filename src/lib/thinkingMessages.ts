export const RESPONDING_MESSAGES = [
  "Connecting to retail intelligence sources...",
  "Scanning category and brand signals...",
  "Pulling market performance data...",
  "Reviewing sales trends and patterns...",
  "Cross-referencing portfolio metrics...",
  "Analyzing competitive positioning...",
  "Synthesizing regional insights...",
  "Evaluating pricing and availability...",
];

export const STRUCTURING_MESSAGES = [
  "Extracting key performance metrics...",
  "Organizing findings into executive summary...",
  "Building comparison tables...",
  "Mapping data points to visualizations...",
  "Highlighting critical takeaways...",
  "Structuring charts and KPI cards...",
  "Formatting insights for the dashboard...",
  "Finalizing your intelligence report...",
];

export function nextThinkingMessage(messages: string[], index: number): string {
  return messages[index % messages.length];
}
