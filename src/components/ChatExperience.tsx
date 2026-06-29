import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { IntelligenceLayer } from "./IntelligenceLayer";
import { ArrowLeftIcon } from "./icons";
import {
  buildVisualization,
  fetchThreadItems,
  getLatestMessages,
  wantsVisualization,
} from "../lib/intelligence";
import { createClientSecretFetcher, workflowId } from "../lib/chatkitSession";
import type { IntelligenceState, VisualizationSpec } from "../types/visualization";

type ChatExperienceProps = {
  initialQuery?: string;
  onBack: () => void;
};

export function ChatExperience({ initialQuery, onBack }: ChatExperienceProps) {
  const sentInitialQuery = useRef(false);
  const threadIdRef = useRef<string | null>(null);
  const lastUserQueryRef = useRef("");
  const [intelligence, setIntelligence] = useState<IntelligenceState>({
    status: "idle",
  });

  const getClientSecret = useMemo(
    () => createClientSecretFetcher(workflowId),
    [],
  );

  const refreshIntelligence = useCallback(async () => {
    const threadId = threadIdRef.current;
    if (!threadId) return;

    setIntelligence({ status: "analyzing" });

    try {
      const items = await fetchThreadItems(threadId);
      const { assistantText, userText } = getLatestMessages(items);
      const query = lastUserQueryRef.current || userText;

      if (!assistantText) {
        setIntelligence({
          status: "empty",
          message: "Waiting for the assistant response to finish.",
        });
        return;
      }

      if (!wantsVisualization(query, assistantText)) {
        setIntelligence({
          status: "empty",
          message:
            "Ask for a comparison, trend, or chart — for example: “Show me a graph of pricing by brand.”",
        });
        return;
      }

      const visualization = await buildVisualization(query, assistantText);

      if (!visualization) {
        setIntelligence({
          status: "empty",
          message:
            "The response did not contain enough structured data for a chart yet. Try asking for a specific comparison or metric.",
        });
        return;
      }

      setIntelligence({ status: "ready", visualization });
    } catch (error) {
      setIntelligence({
        status: "empty",
        message:
          error instanceof Error
            ? error.message
            : "Could not build visualization from the latest response.",
      });
    }
  }, []);

  const { control, sendUserMessage } = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: "dark",
      color: {
        accent: {
          primary: "#0082C5",
          level: 2,
        },
      },
      radius: "round",
      density: "normal",
      typography: {
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      },
    },
    composer: {
      placeholder: "Ask Retail Pulse AI to analyze, compare, or visualize...",
    },
    startScreen: {
      greeting: "Intelligence Layer active",
      prompts: [],
    },
    header: {
      enabled: false,
    },
    onThreadChange: ({ threadId }) => {
      threadIdRef.current = threadId;
    },
    onResponseStart: () => {
      setIntelligence({ status: "analyzing" });
    },
    onResponseEnd: () => {
      void refreshIntelligence();
    },
    onEffect: (event) => {
      if (event.name === "visualization" && event.data) {
        setIntelligence({
          status: "ready",
          visualization: event.data as VisualizationSpec,
        });
      }
    },
  });

  const sendWithTracking = useCallback(
    async (text: string, newThread = false) => {
      lastUserQueryRef.current = text;
      setIntelligence({ status: "analyzing" });
      await sendUserMessage({ text, newThread });
    },
    [sendUserMessage],
  );

  useEffect(() => {
    if (!initialQuery || sentInitialQuery.current) return;

    sentInitialQuery.current = true;
    void sendWithTracking(initialQuery, true);
  }, [initialQuery, sendWithTracking]);

  return (
    <div className="shell shell--workspace">
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

        <div className="ai-workspace__body">
          <section className="ai-workspace__chat">
            <div className="ai-workspace__chat-glow" aria-hidden />
            <ChatKit control={control} className="ai-workspace__chat-panel" />
          </section>
          <IntelligenceLayer state={intelligence} />
        </div>
      </div>
    </div>
  );
}
