import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { IntelligenceLayer } from "./IntelligenceLayer";
import { ArrowLeftIcon } from "./icons";
import { debug, extractTextsDeep } from "../lib/debug";
import { buildFastReportWithFullText } from "../lib/fastReport";
import { pruneReport } from "../lib/pruneReport";
import {
  buildIntelligenceReport,
  fetchLatestThreadId,
  pollForAssistantMessage,
  queriesMatch,
  resolveLatestAssistantResponse,
} from "../lib/intelligence";
import { createClientSecretFetcher, workflowId } from "../lib/chatkitSession";
import type { IntelligenceReport, IntelligenceState } from "../types/visualization";

type ChatExperienceProps = {
  initialQuery?: string;
  onBack: () => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function scheduleUiUpdate(update: () => void) {
  queueMicrotask(update);
}

export function ChatExperience({ initialQuery, onBack }: ChatExperienceProps) {
  const sentInitialQuery = useRef(false);
  const threadIdRef = useRef<string | null>(null);
  const lastUserQueryRef = useRef("");
  const lastProcessedTextRef = useRef("");
  const streamedTextRef = useRef("");
  const pollGenerationRef = useRef(0);
  const chatkitReadyRef = useRef(false);
  const pendingInitialQueryRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const sendAtRef = useRef(0);
  const responseStartedRef = useRef(false);
  const [intelligence, setIntelligence] = useState<IntelligenceState>({
    status: "idle",
  });
  const [composerValue, setComposerValue] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const getClientSecret = useMemo(
    () => createClientSecretFetcher(workflowId),
    [],
  );

  const finalizeIntelligenceRef = useRef<
    (assistantText: string, query: string) => Promise<boolean>
  >(async () => false);
  const processThreadRef = useRef<
    (threadId: string | null, query: string, preferredText?: string) => Promise<void>
  >(async () => {});

  const finalizeIntelligence = useCallback(async (assistantText: string, query: string) => {
    if (!assistantText.trim()) {
      debug.warn("finalizeIntelligence: empty assistant text");
      return false;
    }
    if (assistantText === lastProcessedTextRef.current) {
      debug.log("finalizeIntelligence: already processed this text");
      scheduleUiUpdate(() => setIsBusy(false));
      return true;
    }
    if (
      lastProcessedTextRef.current &&
      assistantText.startsWith(lastProcessedTextRef.current) &&
      assistantText.length <= lastProcessedTextRef.current.length * 1.08
    ) {
      debug.log("finalizeIntelligence: incremental text update skipped");
      scheduleUiUpdate(() => setIsBusy(false));
      return true;
    }

    lastProcessedTextRef.current = assistantText;
    const activeQuery = query || lastUserQueryRef.current;

    debug.log("finalizeIntelligence", {
      query: activeQuery,
      assistantPreview: assistantText.slice(0, 300),
      length: assistantText.length,
    });

    const fallback = pruneReport(buildFastReportWithFullText(assistantText, activeQuery));
    scheduleUiUpdate(() => {
      setIntelligence({
        status: "ready",
        report: fallback,
        userQuery: activeQuery || undefined,
        enriching: true,
      });
      setIsBusy(false);
    });

    void buildIntelligenceReport(activeQuery, assistantText)
      .then((report) => {
        if (assistantText !== lastProcessedTextRef.current) return;
        debug.log("enriched report ready", report.headline);
        scheduleUiUpdate(() => {
          setIntelligence({
            status: "ready",
            report,
            userQuery: activeQuery || undefined,
          });
        });
      })
      .catch((error) => {
        debug.warn("enrichment failed, keeping fast report", error);
      });

    return true;
  }, []);

  const processThread = useCallback(
    async (threadId: string | null, query: string, preferredText = "") => {
      const candidateText = preferredText.trim();
      if (candidateText && candidateText === lastProcessedTextRef.current) {
        debug.log("processThread: skipping duplicate text");
        setIsBusy(false);
        return;
      }
      if (processingRef.current) {
        debug.log("processThread: already in progress");
        return;
      }

      processingRef.current = true;
      const generation = pollGenerationRef.current;

      try {
        if (candidateText) {
          debug.log("processThread: using provided assistant text");
          await finalizeIntelligence(candidateText, query);
          return;
        }

        setIntelligence({
          status: "analyzing",
          userQuery: query || undefined,
          phase: "responding",
        });
        setIsBusy(true);

        let resolvedThreadId = threadId ?? threadIdRef.current;
        if (!resolvedThreadId) {
          debug.log("no threadId from events, fetching latest thread");
          resolvedThreadId = await fetchLatestThreadId();
          if (resolvedThreadId) {
            threadIdRef.current = resolvedThreadId;
            debug.log("resolved threadId from API", resolvedThreadId);
          }
        }

        if (!resolvedThreadId) {
          setIsBusy(false);
          setIntelligence({
            status: "empty",
            message:
              "Could not find a ChatKit thread. Check the console for [RetailPulse] logs and ensure localhost:5173 is on your OpenAI domain allowlist.",
          });
          return;
        }

        const streamed = streamedTextRef.current.trim();
        if (streamed && streamed !== lastProcessedTextRef.current) {
          debug.log("processThread: using streamed text from ChatKit logs");
          await finalizeIntelligence(streamed, query);
          return;
        }

        const { assistantText, userText } = await pollForAssistantMessage(
          resolvedThreadId,
          60,
          400,
          query || lastUserQueryRef.current,
        );
        if (generation !== pollGenerationRef.current) return;

        const activeQuery = query || userText;
        if (
          activeQuery &&
          userText &&
          !queriesMatch(userText, activeQuery)
        ) {
          debug.warn("processThread: user message mismatch, waiting for correct turn");
          setIsBusy(false);
          return;
        }
        if (!assistantText) {
          setIsBusy(false);
          setIntelligence({
            status: "empty",
            message:
              "ChatKit responded but no assistant text was found in the thread. See [RetailPulse] logs in the console for raw thread items.",
          });
          return;
        }

        if (assistantText === lastProcessedTextRef.current) {
          debug.log("processThread: thread text already processed");
          setIsBusy(false);
          return;
        }

        await finalizeIntelligence(assistantText, activeQuery);
      } catch (error) {
        if (generation !== pollGenerationRef.current) return;
        debug.error("processThread failed", error);
        setIsBusy(false);
        setIntelligence({
          status: "empty",
          message:
            error instanceof Error
              ? error.message
              : "Could not load the latest response.",
        });
      } finally {
        processingRef.current = false;
      }
    },
    [finalizeIntelligence],
  );

  finalizeIntelligenceRef.current = finalizeIntelligence;
  processThreadRef.current = processThread;

  const chatKitTheme = useMemo(
    () => ({
      colorScheme: "dark" as const,
      color: {
        accent: {
          primary: "#0082C5",
          level: 2 as const,
        },
      },
      radius: "round" as const,
      density: "compact" as const,
      typography: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      },
    }),
    [],
  );

  const { control, sendUserMessage, fetchUpdates } = useChatKit({
    api: { getClientSecret },
    theme: chatKitTheme,
    composer: {
      placeholder: "Ask Retail Pulse AI to analyze, compare, or visualize...",
    },
    startScreen: {
      greeting: "",
      prompts: [],
    },
    header: {
      enabled: false,
    },
    onReady: () => {
      debug.log("ChatKit ready");
      chatkitReadyRef.current = true;
      const pending = pendingInitialQueryRef.current;
      if (pending && !sentInitialQuery.current) {
        sentInitialQuery.current = true;
        pendingInitialQueryRef.current = null;
        void sendWithTrackingRef.current?.(pending, true);
      }
    },
    onThreadChange: ({ threadId }) => {
      debug.log("thread.change", threadId);
      threadIdRef.current = threadId;
    },
    onThreadLoadStart: ({ threadId }) => {
      debug.log("thread.load.start", threadId);
      threadIdRef.current = threadId;
    },
    onThreadLoadEnd: ({ threadId }) => {
      debug.log("thread.load.end", threadId);
      threadIdRef.current = threadId;
    },
    onResponseStart: () => {
      debug.log("response.start");
      responseStartedRef.current = true;
      streamedTextRef.current = "";
      scheduleUiUpdate(() => {
        setIntelligence({
          status: "analyzing",
          userQuery: lastUserQueryRef.current || undefined,
          phase: "responding",
        });
        setIsBusy(true);
      });
    },
    onResponseEnd: () => {
      debug.log("response.end", { threadId: threadIdRef.current });
      if (lastProcessedTextRef.current || processingRef.current) {
        debug.log("response.end: already handled, skipping");
        scheduleUiUpdate(() => setIsBusy(false));
        return;
      }
      void (async () => {
        await fetchUpdates();
        const streamed = streamedTextRef.current.trim();
        if (streamed.length > 80) {
          debug.log("response.end: finalizing from streamed text");
          await finalizeIntelligenceRef.current(streamed, lastUserQueryRef.current);
          return;
        }
        for (let i = 0; i < 6 && !threadIdRef.current; i += 1) {
          await sleep(300);
          await fetchUpdates();
          const latest = await fetchLatestThreadId();
          if (latest) threadIdRef.current = latest;
        }
        void processThreadRef.current(threadIdRef.current, lastUserQueryRef.current);
      })();
    },
    onError: (detail) => {
      debug.error("ChatKit error", detail.error);
      scheduleUiUpdate(() => {
        setIsBusy(false);
        setIntelligence({
          status: "empty",
          message: detail.error?.message ?? "ChatKit encountered an error.",
        });
      });
    },
    onLog: (detail) => {
      debug.log("chatkit.log", detail.name, detail.data);

      const data = detail.data as Record<string, unknown> | undefined;
      const threadId =
        (typeof data?.thread_id === "string" && data.thread_id) ||
        (typeof data?.threadId === "string" && data.threadId) ||
        null;
      if (threadId) {
        threadIdRef.current = threadId;
      }

      const texts = extractTextsDeep(detail.data);
      if (texts.length) {
        streamedTextRef.current = texts.join("\n\n");
        debug.log("streamed text updated", streamedTextRef.current.slice(0, 200));
      }
    },
    onEffect: (event) => {
      debug.log("chatkit.effect", event.name, event.data);
      if (event.name === "visualization" && event.data) {
        const legacy = event.data as IntelligenceReport & {
          title?: string;
          type?: string;
          data?: unknown[];
          insight?: string;
          subtitle?: string;
          metrics?: IntelligenceReport["metrics"];
        };
        const report: IntelligenceReport =
          legacy.headline && legacy.summary
            ? (legacy as IntelligenceReport)
            : {
                headline: legacy.title ?? "Retail analysis",
                summary: legacy.insight ?? "Structured insight from the response.",
                metrics: legacy.metrics ?? [],
                highlights: legacy.insight ? [legacy.insight] : [],
                sections: [],
                charts: legacy.data
                  ? [
                      {
                        title: legacy.title ?? "Chart",
                        subtitle: legacy.subtitle,
                        type: (legacy.type as IntelligenceReport["charts"][0]["type"]) ?? "bar",
                        data: legacy.data as IntelligenceReport["charts"][0]["data"],
                        insight: legacy.insight,
                      },
                    ]
                  : [],
              };

        lastProcessedTextRef.current = report.summary;
        scheduleUiUpdate(() => {
          setIsBusy(false);
          setIntelligence({
            status: "ready",
            report,
            userQuery: lastUserQueryRef.current || undefined,
          });
        });
      }
    },
  });

  const sendWithTrackingRef = useRef<
    ((text: string, newThread?: boolean) => Promise<void>) | null
  >(null);

  const sendWithTracking = useCallback(
    async (text: string, newThread = false) => {
      if (!chatkitReadyRef.current) {
        debug.log("ChatKit not ready, queueing query", text);
        pendingInitialQueryRef.current = text;
        return;
      }

      debug.log("sendUserMessage", { text, newThread });
      lastUserQueryRef.current = text;
      lastProcessedTextRef.current = "";
      streamedTextRef.current = "";
      processingRef.current = false;
      responseStartedRef.current = false;
      sendAtRef.current = Date.now();
      pollGenerationRef.current += 1;
      scheduleUiUpdate(() => {
        setIntelligence({
          status: "analyzing",
          userQuery: text,
          phase: "responding",
        });
        setIsBusy(true);
      });

      try {
        await sendUserMessage({ text, newThread });
        debug.log("sendUserMessage complete");
        await fetchUpdates();
      } catch (error) {
        debug.error("sendUserMessage failed", error);
        setIsBusy(false);
        setIntelligence({
          status: "empty",
          message:
            error instanceof Error
              ? error.message
              : "Failed to send message to ChatKit.",
        });
      }
    },
    [fetchUpdates, sendUserMessage],
  );

  sendWithTrackingRef.current = sendWithTracking;

  useEffect(() => {
    if (!initialQuery || sentInitialQuery.current) return;

    if (chatkitReadyRef.current) {
      sentInitialQuery.current = true;
      void sendWithTracking(initialQuery, true);
      return;
    }

    pendingInitialQueryRef.current = initialQuery;
  }, [initialQuery, sendWithTracking]);

  useEffect(() => {
    if (!isBusy || lastProcessedTextRef.current) return;

    const interval = setInterval(() => {
      if (lastProcessedTextRef.current || processingRef.current) return;

      void (async () => {
        if (Date.now() - sendAtRef.current < 2500) return;
        if (!responseStartedRef.current) return;

        await fetchUpdates();
        const result = await resolveLatestAssistantResponse(
          threadIdRef.current,
          lastUserQueryRef.current,
        );
        if (result.threadId) threadIdRef.current = result.threadId;
        if (!result.assistantText || result.assistantText === lastProcessedTextRef.current) {
          return;
        }
        if (!queriesMatch(result.userText, lastUserQueryRef.current)) {
          debug.log("backup poll: query mismatch, skipping stale response");
          return;
        }
        debug.log("backup poll found assistant text");
        void processThreadRef.current(
          result.threadId,
          lastUserQueryRef.current,
          result.assistantText,
        );
      })();
    }, 1200);

    return () => clearInterval(interval);
  }, [fetchUpdates, isBusy]);

  useEffect(() => {
    if (!isBusy) return;

    const timeout = setTimeout(() => {
      debug.warn("global busy timeout reached");
      setIsBusy(false);
      setIntelligence((current) => {
        if (current.status !== "analyzing") return current;
        return {
          status: "empty",
          message:
            "Timed out waiting for a response. Open the browser console and filter for [RetailPulse] to see debug logs.",
        };
      });
    }, 120000);

    return () => clearTimeout(timeout);
  }, [isBusy]);

  const handleComposerSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = composerValue.trim();
      if (!text || isBusy) return;

      setComposerValue("");
      await sendWithTracking(text);
    },
    [composerValue, isBusy, sendWithTracking],
  );

  return (
    <div className="shell shell--workspace shell--light">
      <div className="shell__grid" aria-hidden />
      <div className="shell__ambient" aria-hidden>
        <div className="shell__orb shell__orb--primary" />
        <div className="shell__orb shell__orb--sky" />
        <div className="shell__orb shell__orb--ice" />
      </div>

      <div className="ai-workspace">
        <header className="ai-workspace__header">
          <button type="button" className="chat-shell__back" onClick={onBack}>
            <ArrowLeftIcon />
            Back
          </button>
          <div className="nav__brand nav__brand--compact nav__brand--on-dark">
            <span className="nav__mark" aria-hidden />
            Retail Pulse AI
          </div>
          <span className="ai-workspace__badge">Intelligence Layer</span>
        </header>

        <div className="ai-workspace__chatkit-host" aria-hidden>
          <ChatKit control={control} className="ai-workspace__chat-panel" />
        </div>

        <div className="ai-workspace__canvas">
          <IntelligenceLayer state={intelligence} />
        </div>

        <form className="ai-workspace__composer-dock" onSubmit={handleComposerSubmit}>
          <div className="workspace-composer">
            <input
              type="text"
              className="workspace-composer__input"
              value={composerValue}
              onChange={(event) => setComposerValue(event.target.value)}
              placeholder="Ask Retail Pulse AI to analyze, compare, or visualize..."
              disabled={isBusy}
              aria-label="Message Retail Pulse AI"
            />
            <button
              type="submit"
              className="workspace-composer__send"
              disabled={isBusy || !composerValue.trim()}
            >
              {isBusy ? "Thinking..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
