import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpIcon } from "./icons";
import { suggestions } from "../data/suggestions";

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
    <div className="shell">
      <div className="shell__ambient" aria-hidden>
        <div className="shell__orb shell__orb--primary" />
        <div className="shell__orb shell__orb--sky" />
        <div className="shell__orb shell__orb--ice" />
      </div>

      <nav className="nav">
        <div className="nav__brand">
          <span className="nav__mark" aria-hidden />
          Retail Pulse AI
        </div>
      </nav>

      <main className="hero">
        <div className="hero__intro">
          <p className="hero__greeting">Hello Manager</p>
          <h1>What would you like to understand today?</h1>
          <p className="hero__lead">
            Analyze retail signals, uncover performance drivers, and get
            actionable recommendations across pricing, availability, visibility,
            and portfolio.
          </p>
        </div>

        <form className="composer" onSubmit={onSubmit}>
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

        <section className="prompts" aria-label="Suggested questions">
          <p className="prompts__label">Suggested questions</p>
          <div className="prompts__grid">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`prompt-card prompt-card--${item.id}`}
                onClick={() => onStartChat(item.question)}
              >
                <span className="prompt-card__category">{item.title}</span>
                <span className="prompt-card__text">{item.question}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
