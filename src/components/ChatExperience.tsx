import { useEffect, useMemo, useRef } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { createClientSecretFetcher, workflowId } from "../lib/chatkitSession";
import { ArrowLeftIcon } from "./icons";

type ChatExperienceProps = {
  initialQuery?: string;
  onBack: () => void;
};

export function ChatExperience({ initialQuery, onBack }: ChatExperienceProps) {
  const sentInitialQuery = useRef(false);

  const getClientSecret = useMemo(
    () => createClientSecretFetcher(workflowId),
    [],
  );

  const { control, sendUserMessage } = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: "light",
      color: {
        accent: {
          primary: "#2563eb",
          level: 2,
        },
      },
      radius: "round",
      density: "normal",
      typography: {
        fontFamily: "'Inter', system-ui, sans-serif",
      },
    },
    composer: {
      placeholder: "Ask a follow-up question...",
    },
    startScreen: {
      greeting: "Retail Pulse AI is ready.",
      prompts: [],
    },
    header: {
      enabled: false,
    },
  });

  useEffect(() => {
    if (!initialQuery || sentInitialQuery.current) return;

    sentInitialQuery.current = true;
    void sendUserMessage({ text: initialQuery, newThread: true });
  }, [initialQuery, sendUserMessage]);

  return (
    <div className="chat-page">
      <header className="chat-page__header">
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeftIcon />
          New question
        </button>
        <div className="chat-page__brand">
          <span className="chat-page__dot" aria-hidden />
          Retail Pulse AI
        </div>
        <div className="chat-page__spacer" />
      </header>

      <div className="chat-page__body">
        <ChatKit control={control} className="chat-page__panel" />
      </div>
    </div>
  );
}
