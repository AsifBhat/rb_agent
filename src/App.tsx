import { useState } from "react";
import { ChatExperience } from "./components/ChatExperience";
import { LandingPage } from "./components/LandingPage";

const userName =
  import.meta.env.VITE_USER_NAME?.trim() || "Amit";

export default function App() {
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  if (activeQuery !== null) {
    return (
      <ChatExperience
        initialQuery={activeQuery}
        onBack={() => setActiveQuery(null)}
      />
    );
  }

  return <LandingPage userName={userName} onStartChat={setActiveQuery} />;
}
