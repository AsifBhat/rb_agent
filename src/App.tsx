import { ChatWidget } from "./components/ChatWidget";

export default function App() {
  return (
    <div className="page">
      <header className="header">
        <h1>Chat Assistant</h1>
        <p>Powered by your OpenAI Agent Builder workflow.</p>
      </header>
      <ChatWidget />
    </div>
  );
}
