import { useMemo } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { createClientSecretFetcher, workflowId } from "../lib/chatkitSession";

export function ChatWidget() {
  const getClientSecret = useMemo(
    () => createClientSecretFetcher(workflowId),
    [],
  );

  const chatkit = useChatKit({
    api: { getClientSecret },
  });

  return (
    <div className="chat-shell">
      <ChatKit control={chatkit.control} className="chat-panel" />
    </div>
  );
}
