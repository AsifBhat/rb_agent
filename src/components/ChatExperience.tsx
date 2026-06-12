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
      placeholder: "Ask a follow-up...",
    },
    startScreen: {
      greeting: "",
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
    <div className="chat-shell">
      <header className="chat-shell__header">
        <button type="button" className="chat-shell__back" onClick={onBack}>
          <ArrowLeftIcon />
          Back
        </button>
        <div className="nav__brand nav__brand--compact">
          <span className="nav__mark" aria-hidden />
          Retail Pulse AI
        </div>
      </header>

      <div className="chat-shell__main">
        <ChatKit control={control} className="chat-shell__panel" />
      </div>
    </div>
  );
}
