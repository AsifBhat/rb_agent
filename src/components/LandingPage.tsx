import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpIcon } from "./icons";

type LandingPageProps = {
  onStartChat: (question: string) => void;
};

export function LandingPage({ onStartChat }: LandingPageProps) {
  const [query, setQuery] = useState("");

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onStartChat(trimmed);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shell shell--light shell--landing">
      <div className="shell__grid" aria-hidden />
      <div className="shell__ambient" aria-hidden>
        <div className="shell__orb shell__orb--primary" />
        <div className="shell__orb shell__orb--sky" />
        <div className="shell__orb shell__orb--ice" />
      </div>

      <main className="intel-entry">
        <div className="intel-entry__halo" aria-hidden />

        <header className="intel-entry__header">
          <div className="intel-entry__brand">
            <span className="nav__mark" aria-hidden />
            <span>Retail Pulse AI</span>
          </div>
          <div className="intel-entry__status">
            <span className="intel-entry__pulse" aria-hidden />
            Intelligence Layer active
          </div>
        </header>

        <section className="intel-entry__core">
          <p className="hero__greeting">Hello Manager</p>
          <h1>What would you like to understand today?</h1>

          <form className="composer composer--layer" onSubmit={onSubmit}>
            <div className="composer__surface">
              <textarea
                className="composer__input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask anything about your retail data..."
                rows={1}
                aria-label="Your question"
              />
              <button
                type="submit"
                className="composer__send"
                disabled={!query.trim()}
                aria-label="Send question"
              >
                <ArrowUpIcon />
              </button>
            </div>
            <p className="composer__hint">
              Press Enter to send · Shift + Enter for a new line
            </p>
          </form>
        </section>

        <div className="intel-entry__signals" aria-hidden>
          <span>Signals</span>
          <span>Insights</span>
          <span>Actions</span>
        </div>
      </main>
    </div>
  );
}
