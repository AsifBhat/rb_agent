import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  BellIcon,
  BoxIcon,
  ChartIcon,
  EyeIcon,
  SparkleIcon,
  TagIcon,
} from "./icons";
import { suggestions, type Suggestion } from "../data/suggestions";

type LandingPageProps = {
  userName?: string;
  onStartChat: (question: string) => void;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function SuggestionIcon({ icon }: { icon: Suggestion["icon"] }) {
  const className = "suggestion-card__icon-svg";
  switch (icon) {
    case "visibility":
      return <EyeIcon className={className} />;
    case "availability":
      return <BoxIcon className={className} />;
    case "pricing":
      return <TagIcon className={className} />;
    case "portfolio":
      return <ChartIcon className={className} />;
  }
}

export function LandingPage({ userName = "there", onStartChat }: LandingPageProps) {
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
    <div className="landing">
      <div className="landing__glow landing__glow--left" aria-hidden />
      <div className="landing__glow landing__glow--right" aria-hidden />

      <header className="landing__topbar">
        <div>
          <p className="landing__greeting">
            {getGreeting()}, {userName} <span aria-hidden>👋</span>
          </p>
        </div>
        <div className="landing__actions">
          <button type="button" className="icon-button" aria-label="Notifications">
            <BellIcon />
            <span className="icon-button__badge">3</span>
          </button>
          <div className="avatar" aria-hidden>
            {userName.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      <section className="landing__hero">
        <div className="landing__badge">
          <SparkleIcon />
          Retail Pulse AI
        </div>
        <h1>What would you like to understand today?</h1>
        <p className="landing__subtitle">
          Ask a business question and Retail Pulse AI will analyze retail signals,
          identify performance drivers, and recommend actions across pricing,
          availability, visibility, portfolio and sales.
        </p>

        <form className="query-card" onSubmit={onSubmit}>
          <textarea
            className="query-card__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Retail Pulse AI anything..."
            rows={4}
            aria-label="Your question"
          />
          <div className="query-card__footer">
            <span>Get instant insights on your retail data.</span>
            <button type="submit" className="primary-button" disabled={!query.trim()}>
              Analyze Question
            </button>
          </div>
        </form>
      </section>

      <section className="landing__explore">
        <div className="landing__explore-header">
          <h2>Explore Retail Intelligence</h2>
          <p>Choose a business area or start with a suggested question.</p>
        </div>

        <div className="suggestion-grid">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              className="suggestion-card"
              onClick={() => onStartChat(item.question)}
            >
              <span className="suggestion-card__icon">
                <SuggestionIcon icon={item.icon} />
              </span>
              <span className="suggestion-card__content">
                <strong>{item.title}</strong>
                <span>{item.question}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
