import { ChartRenderer } from "./charts/ChartRenderer";
import type { IntelligenceState } from "../types/visualization";

type IntelligenceLayerProps = {
  state: IntelligenceState;
};

export function IntelligenceLayer({ state }: IntelligenceLayerProps) {
  return (
    <aside className="intel-layer" aria-label="Intelligence Layer">
      <div className="intel-layer__header">
        <div>
          <p className="intel-layer__eyebrow">Intelligence Layer</p>
          <h2>Live retail analytics</h2>
        </div>
        <span
          className={`intel-layer__pulse intel-layer__pulse--${state.status}`}
          aria-hidden
        />
      </div>

      {state.status === "idle" && (
        <div className="intel-layer__empty">
          <div className="intel-layer__orb" aria-hidden />
          <h3>AI insights will appear here</h3>
          <p>
            Ask a question and Retail Pulse AI will translate the response into
            charts, metrics, and executive-ready visual intelligence.
          </p>
        </div>
      )}

      {state.status === "analyzing" && (
        <div className="intel-layer__loading">
          <div className="intel-layer__scan" aria-hidden />
          <p>Synthesizing visualization</p>
          <span>Extracting signals from the latest response...</span>
        </div>
      )}

      {state.status === "empty" && (
        <div className="intel-layer__empty">
          <h3>No chartable data yet</h3>
          <p>{state.message}</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="intel-layer__content">
          <article className="intel-card intel-card--insight">
            <p className="intel-card__label">Executive insight</p>
            <p className="intel-card__insight">{state.visualization.insight}</p>
          </article>

          {state.visualization.metrics?.length ? (
            <div className="intel-metrics">
              {state.visualization.metrics.map((metric) => (
                <div key={metric.label} className="intel-metric">
                  <span>{metric.label}</span>
                  <strong className={`intel-metric__value--${metric.tone ?? "neutral"}`}>
                    {metric.value}
                  </strong>
                </div>
              ))}
            </div>
          ) : null}

          <article className="intel-card intel-card--chart">
            <div className="intel-card__chart-header">
              <div>
                <p className="intel-card__label">Visualization</p>
                <h3>{state.visualization.title}</h3>
                {state.visualization.subtitle ? (
                  <p className="intel-card__subtitle">{state.visualization.subtitle}</p>
                ) : null}
              </div>
              <span className="intel-card__type">{state.visualization.type}</span>
            </div>
            <ChartRenderer spec={state.visualization} />
          </article>
        </div>
      )}
    </aside>
  );
}
