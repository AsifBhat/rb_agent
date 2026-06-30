import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChartRenderer } from "./charts/ChartRenderer";
import { ChartIcon, SparkleIcon } from "./icons";
import { buildDashboardView, type RecommendationCard } from "../lib/dashboardModel";
import { pruneReport } from "../lib/pruneReport";
import { nextThinkingMessage, RESPONDING_MESSAGES } from "../lib/thinkingMessages";
import type { IntelligenceState, MetricItem, ReportSection } from "../types/visualization";

type IntelligenceLayerProps = {
  state: IntelligenceState;
};

function SectionLabel({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <div className="il-section-label">
      <span className="il-section-label__icon">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function PremiumTable({ section }: { section: Extract<ReportSection, { type: "table" }> }) {
  return (
    <article className="il-glass il-table-card">
      <h3 className="il-table-card__title">{section.title}</h3>
      <div className="il-table-scroll">
        <table className="il-table">
          <thead>
            <tr>
              {section.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function KpiBenchmark({ kpis }: { kpis: MetricItem[] }) {
  const rows = kpis
    .map((kpi) => {
      const num = Number(String(kpi.value).replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(num)) return null;
      return { ...kpi, num };
    })
    .filter((row): row is MetricItem & { num: number } => row !== null);

  if (rows.length < 2) return null;

  const max = Math.max(...rows.map((row) => row.num), 1);

  return (
    <div className="il-benchmark" aria-hidden>
      {rows.map((row) => (
        <div key={row.label} className={`il-benchmark__row il-benchmark__row--${row.tone ?? "neutral"}`}>
          <span className="il-benchmark__label">{row.label}</span>
          <div className="il-benchmark__track">
            <div
              className="il-benchmark__fill"
              style={{ width: `${Math.max(4, (row.num / max) * 100)}%` }}
            />
          </div>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function KpiGrid({ kpis }: { kpis: ReturnType<typeof buildDashboardView>["kpis"] }) {
  return (
    <div className="il-kpi-section">
      <div className="il-kpi-grid">
        {kpis.map((kpi, index) => (
          <div
            key={kpi.label}
            className={`il-kpi il-kpi--${kpi.tone ?? "neutral"}`}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="il-kpi__glow" aria-hidden />
            <strong className="il-kpi__value">{kpi.value}</strong>
            <span className="il-kpi__label">{kpi.label}</span>
          </div>
        ))}
      </div>
      <KpiBenchmark kpis={kpis} />
    </div>
  );
}

function ActionCards({ items }: { items: RecommendationCard[] }) {
  return (
    <section className="il-actions">
      <SectionLabel icon={<SparkleIcon className="il-icon" />}>Priority actions</SectionLabel>
      <div className="il-actions__grid">
        {items.map((item, index) => (
          <article
            key={`${item.title}-${index}`}
            className={`il-action il-action--${item.urgencyTone}`}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="il-action__top">
              <span className="il-action__index">{String(index + 1).padStart(2, "0")}</span>
              {item.urgency ? (
                <span className={`il-action__badge il-action__badge--${item.urgencyTone}`}>
                  {item.urgency}
                </span>
              ) : null}
            </div>
            <h4 className="il-action__title">{item.title}</h4>
            {item.gap ? <p className="il-action__gap">{item.gap}</p> : null}
            {item.why ? <p className="il-action__why">{item.why}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function InsightStrip({ items }: { items: string[] }) {
  return (
    <section className="il-insights">
      <SectionLabel icon={<SparkleIcon className="il-icon" />}>Key signals</SectionLabel>
      <div className="il-insights__track">
        {items.map((item) => (
          <div key={item} className="il-insight-pill">
            <span className="il-insight-pill__dot" aria-hidden />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function ThinkingPanel({ userQuery }: { userQuery?: string }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((c) => c + 1);
        setVisible(true);
      }, 220);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="il-loading">
      <div className="il-loading__orb" aria-hidden />
      <div className="il-loading__ring" aria-hidden />
      <p className="il-loading__title">Synthesizing intelligence</p>
      <span className={`il-loading__msg ${visible ? "is-visible" : ""}`}>
        {nextThinkingMessage(RESPONDING_MESSAGES, index)}
      </span>
      {userQuery ? <span className="il-loading__query">“{userQuery}”</span> : null}
    </div>
  );
}

export function IntelligenceLayer({ state }: IntelligenceLayerProps) {
  const userQuery =
    state.status === "ready" || state.status === "analyzing"
      ? state.userQuery
      : undefined;

  const dash = useMemo(() => {
    if (state.status !== "ready") return null;
    return buildDashboardView(pruneReport(state.report));
  }, [state]);

  const heroTable = dash?.tables.find((t) =>
    /share|rank|store|brand|listing/i.test(t.title + t.columns.join(" ")),
  );
  const detailTables = dash?.tables.filter((t) => t !== heroTable) ?? [];

  return (
    <main className="intel-layer intel-layer--premium" aria-label="Intelligence Layer">
      {state.status === "idle" && (
        <div className="il-empty">
          <div className="il-empty__icon" aria-hidden>
            <SparkleIcon className="il-icon il-icon--lg" />
          </div>
          <h3>Intelligence Layer</h3>
          <p>Ask a question below. AI will synthesize metrics, charts, and actions.</p>
        </div>
      )}

      {state.status === "analyzing" && <ThinkingPanel userQuery={state.userQuery} />}

      {state.status === "empty" && (
        <div className="il-empty">
          <h3>Unable to synthesize</h3>
          <p>{state.message}</p>
        </div>
      )}

      {state.status === "ready" && dash && (
        <>
          <header className="il-hero">
            <div className="il-hero__mesh" aria-hidden />
            <div className="il-hero__content">
              <div className="il-hero__meta">
                <span className="il-ai-badge">
                  <SparkleIcon className="il-icon" />
                  Intelligence Layer
                </span>
                <span
                  className={`il-status il-status--${state.enriching ? "sync" : "live"}`}
                >
                  {state.enriching ? "Enhancing" : "Live"}
                </span>
              </div>
              <h2 className="il-hero__headline">{dash.headline}</h2>
              {userQuery ? <p className="il-hero__query">{userQuery}</p> : null}
              {dash.summary ? (
                <p className="il-hero__insight">{dash.summary}</p>
              ) : null}
            </div>
          </header>

          <div className="il-canvas" key={userQuery ?? dash.headline}>
            {dash.kpis.length > 0 ? <KpiGrid kpis={dash.kpis} /> : null}

            {dash.chart ? (
              <article className="il-glass il-chart-card il-chart-card--hero il-fade-up">
                <SectionLabel icon={<ChartIcon className="il-icon" />}>
                  {dash.chart.title}
                </SectionLabel>
                <ChartRenderer spec={dash.chart} />
                {dash.chart.insight ? (
                  <p className="il-chart-card__insight">{dash.chart.insight}</p>
                ) : null}
              </article>
            ) : null}

            {(heroTable || detailTables.length > 0) && (
              <div className={`il-bento ${dash.chart && heroTable ? "il-bento--split" : "il-bento--tables"}`}>
                {heroTable ? (
                  <div className="il-fade-up" style={{ animationDelay: "80ms" }}>
                    <PremiumTable section={heroTable} />
                  </div>
                ) : null}
                {detailTables.map((table, i) => (
                  <div
                    key={table.title}
                    className="il-fade-up"
                    style={{ animationDelay: `${120 + i * 60}ms` }}
                  >
                    <PremiumTable section={table} />
                  </div>
                ))}
              </div>
            )}

            {!dash.chart && !heroTable && dash.tables.length > 0 ? (
              <div className="il-bento il-bento--tables">
                {dash.tables.map((table, i) => (
                  <div key={table.title} className="il-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <PremiumTable section={table} />
                  </div>
                ))}
              </div>
            ) : null}

            {dash.recommendations && dash.recommendations.length > 0 ? (
              <ActionCards items={dash.recommendations} />
            ) : null}

            {dash.takeaways.length > 0 ? <InsightStrip items={dash.takeaways} /> : null}

            {dash.sourceTranscript ? (
              <details className="il-source">
                <summary>
                  <SparkleIcon className="il-icon" />
                  View source transcript
                </summary>
                <pre className="il-source__body">{dash.sourceTranscript}</pre>
              </details>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
