import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import "@fontsource-variable/dm-sans";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./style.css";

import { useWorkspace, type ReadingDomain, type ReadingEvidence, type ReadingMethod } from "./useWorkspace";

const methods: Array<[ReadingMethod, string]> = [["compare", "Compare lenses"], ["vedic", "Vedic"], ["kp", "KP"], ["western", "Western"]];
const domains: ReadingDomain[] = ["general", "career", "relationships", "marriage", "family", "money", "health", "purpose", "personality", "education", "spirituality", "timing", "compatibility"];
const chartStarters = ["What patterns does my chart suggest?", "How does my chart describe my relationships?", "What can I reflect on about my work?"];

function Evidence({ evidence }: { evidence: ReadingEvidence }) {
  return (
    <details className="reading-evidence">
      <summary>Explore calculation evidence <span>({evidence.items.length})</span></summary>
      <p className="evidence-context">{evidence.method === "kp" ? "KP" : evidence.method} · {evidence.domain} · birth time: {evidence.birth_time_quality}</p>
      {evidence.limitations.length > 0 && (
        <div className="evidence-limitations">
          <h3>Limits of this reading</h3>
          <ul>{evidence.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul>
        </div>
      )}
      <div className="evidence-items">
        {evidence.items.map((item, index) => (
          <details key={`${item.id}-${index}`}>
            <summary><code>{item.id}</code><span>{item.system} · {item.kind.replaceAll("_", " ")}</span></summary>
            <pre>{typeof item.detail === "string" ? item.detail : JSON.stringify(item.detail, null, 2)}</pre>
          </details>
        ))}
      </div>
      {!evidence.items.length && <p>No calculation items were available for this reading.</p>}
      <details className="evidence-provenance">
        <summary>Reading provenance</summary>
        <dl>
          <dt>Evidence set</dt><dd><code>{evidence.id}</code></dd>
          <dt>Engine revision</dt><dd><code>{evidence.engine_revision}</code></dd>
          <dt>Chart digest</dt><dd><code>{evidence.chart_digest}</code></dd>
        </dl>
      </details>
    </details>
  );
}

const starters = [
  "I feel pulled in different directions.",
  "Help me understand my relationships.",
  "What should I make more space for?",
];
const signs = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

function App() {
  const {
    profile,
    chart,
    history,
    draft,
    setDraft,
    busy,
    error,
    notice,
    health,
    editing,
    setEditing,
    update,
    compute,
    send,
    clear,
    page,
    setPage,
    ready,
    activeJob,
    legacy,
    importLegacy,
    method,
    setMethod,
    domain,
    setDomain,
    reconnect,
    failedMessage,
    retry,
  } = useWorkspace();
  const conversationEnd = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const birthDetails = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (history.length)
      conversationEnd.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [history.length, busy, page]);
  const planets = chart?.chart.tropical_planets ?? [];
  const sun = planets.find((p) => p.name.toLowerCase() === "sun");
  const moon = planets.find((p) => p.name.toLowerCase() === "moon");
  const ascendant = chart?.chart.ascendant_tropical;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#" aria-label="Iktara home">
          <span className="brand-symbol" aria-hidden="true">
            ✳
          </span>{" "}
          iktara<span className="brand-dot">.</span>
        </a>
        <div className="topbar-right">
          <span className="status">
            <i />
            {health}
          </span>
          <span className="byline">a space by intuitxn</span>
        </div>
      </header>
      <main>
        <section className="intro">
          <div className="eyebrow">
            <span /> COME AS YOU ARE
          </div>
          <h1>
            A little closer
            <br />
            to <em>yourself.</em>
          </h1>
          <p>
            Some questions need a little space.
            <br />
            Explore your patterns, your possibilities, and what matters to you.
          </p>
          <div className="orbit" aria-hidden="true">
            <div className="orbit-inner" />
            <div className="orbit-core">✧</div>
            <span className="orbit-star star-one">✦</span>
            <span className="orbit-star star-two">✧</span>
            <span className="orbit-caption">AS ABOVE · SO WITHIN</span>
          </div>
        </section>
        <div className="workspace">
          <aside className="profile-panel" ref={birthDetails}>
            <div className="section-label">
              01 <span>YOUR STARTING POINT</span>
            </div>
            <div className="panel-heading">
              <h2>
                {chart && !editing
                  ? "Your constellation"
                  : "Written in the stars"}
              </h2>
              {chart && !editing && (
                <button
                  className="text-button"
                  onClick={() => setEditing(true)}
                  disabled={!!busy}
                >
                  Edit
                </button>
              )}
            </div>
            {editing ? (
              <>
                <p className="muted panel-description">
                  Add your birth details for a personal chart. Or simply start a
                  conversation.
                </p>
                <form onSubmit={compute} className="profile-form">
                  <label>
                    What should we call you?{" "}
                    <span className="optional">optional</span>
                    <input
                      autoComplete="given-name"
                      value={profile.name}
                      placeholder="Your name"
                      maxLength={80}
                      onChange={(e) => update("name", e.target.value)}
                      disabled={!!busy}
                    />
                  </label>
                  <div className="field-row">
                    <label>
                      Birth date
                      <input
                        type="date"
                        required
                        value={profile.date_of_birth}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) =>
                          update("date_of_birth", e.target.value)
                        }
                        disabled={!!busy}
                      />
                    </label>
                    <label>
                      Birth time
                      <input
                        type="time"
                        value={profile.time_of_birth || ""}
                        required={profile.birth_time_quality !== "unknown"}
                        disabled={
                          !!busy || profile.birth_time_quality === "unknown"
                        }
                        onChange={(e) =>
                          update("time_of_birth", e.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label>
                    How certain is the time?
                    <select
                      value={profile.birth_time_quality}
                      onChange={(e) =>
                        update("birth_time_quality", e.target.value)
                      }
                      disabled={!!busy}
                    >
                      <option value="exact">I know the exact time</option>
                      <option value="approximate">It is approximate</option>
                      <option value="unknown">
                        I do not know my birth time
                      </option>
                    </select>
                  </label>
                  <label>
                    Birthplace
                    <input
                      required
                      autoComplete="off"
                      value={profile.birthplace}
                      placeholder="City, country"
                      maxLength={200}
                      onChange={(e) => update("birthplace", e.target.value)}
                      disabled={!!busy}
                    />
                  </label>
                  <button
                    className="primary-button"
                    disabled={!ready || !!busy}
                    type="submit"
                  >
                    {busy === "chart"
                      ? "Finding your constellation…"
                      : "Explore my chart"}
                    <span aria-hidden="true">↗</span>
                  </button>
                </form>
                <button
                  className="skip-button"
                  onClick={() => { setPage("reflection"); composer.current?.focus(); }}
                >
                  Just here to reflect? Start a conversation{" "}
                  <span aria-hidden="true">→</span>
                </button>
              </>
            ) : (
              <div className="chart-summary">
                <p className="chart-name">
                  {profile.name || "Your birth chart"}
                </p>
                <p className="muted">
                  {profile.date_of_birth} ·{" "}
                  {profile.time_of_birth || "Time unknown"}
                  <br />
                  {chart?.display_name || profile.birthplace}
                </p>
                <div className="placements">
                  {[
                    ["☉", "Sun", sun?.sign],
                    ["☽", "Moon", moon?.sign],
                    [
                      "↗",
                      "Rising",
                      profile.birth_time_quality === "unknown"
                        ? "Time needed"
                        : typeof ascendant === "number"
                          ? signs[
                              Math.floor((((ascendant % 360) + 360) % 360) / 30)
                            ]
                          : undefined,
                    ],
                  ].map(([icon, label, value]) => (
                    <div className="placement" key={label}>
                      <span className="planet-icon">{icon}</span>
                      <div>
                        <small>{label}</small>
                        <strong>{value || "Unavailable"}</strong>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="fine-print">
                  Tropical placements ·{" "}
                  {profile.birth_time_quality === "exact"
                    ? "Based on the birth details you shared."
                    : "Uncertain birth times can change time-sensitive placements."}
                </p>
              </div>
            )}
            <div className="privacy-note">
              <span aria-hidden="true">⌑</span>
              <p>
                No sign-in. This browser’s private session opens your saved
                space on our server. People sharing this browser share this
                space. Messages and chart context are sent for AI processing.
              </p>
            </div>
            {legacy && (
              <button
                className="text-button clear-button"
                onClick={importLegacy}
                disabled={!ready || !!busy}
              >
                Import earlier birth details from this browser
              </button>
            )}
            <button
              className="text-button clear-button"
              onClick={clear}
              disabled={!!busy}
            >
              Clear my saved data
            </button>
          </aside>
          <section
            className="conversation-panel"
            aria-label="Your conversation"
          >
            <div className="conversation-heading">
              <div className="section-label">
                02{" "}
                <span>
                  {page === "chart"
                    ? "YOUR CHART COMPANION"
                    : "A SPACE TO REFLECT"}
                </span>
              </div>
              <span className="small-star" aria-hidden="true">
                ✧
              </span>
            </div>
            <div
              className="world-tabs"
              role="tablist"
              aria-label="Choose a space"
            >
              <button
                type="button"
                role="tab"
                aria-selected={page === "reflection"}
                onClick={() => setPage("reflection")}
              >
                Reflect
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={page === "chart"}
                onClick={() => setPage("chart")}
              >
                Explore my chart
              </button>
            </div>
            {page === "chart" && (
              <>
                <div className="reading-controls">
                  <label>Astrology lens
                    <select value={method} onChange={(e) => setMethod(e.target.value as ReadingMethod)} disabled={!!busy}>
                      {methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>Topic <span className="optional">optional</span>
                    <select value={domain} onChange={(e) => setDomain(e.target.value as ReadingDomain | "")} disabled={!!busy}>
                      <option value="">General reading (default)</option>
                      {domains.map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
                    </select>
                  </label>
                </div>
                {chart && profile.birth_time_quality !== "exact" && (
                  <p className="birth-time-warning" role="note">
                    {profile.birth_time_quality === "unknown" ? "Birth time unknown." : "Birth time approximate."} Time-sensitive placements and timing may be unreliable. Each reading includes its calculation limits.
                  </p>
                )}
                {!chart && ready && (
                  <div className="calculate-first">
                    <h2>Start with your chart</h2>
                    <p>Add or update your birth details and calculate a chart before asking for a reading. Reflect is available without one.</p>
                    <button className="text-button" onClick={() => {
                      setEditing(true);
                      birthDetails.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}>Go to birth details →</button>
                  </div>
                )}
              </>
            )}
            <div
              className="conversation"
              aria-live="polite"
              aria-busy={busy === "chat"}
            >
              {!ready ? <p className="thinking" role="status">Opening your saved space…</p> : !history.length ? (
                <div className="empty-conversation">
                  <div className="conversation-symbol" aria-hidden="true">
                    ✧
                  </div>
                  <h2>
                    {page === "chart" ? "What would you like to explore?" : profile.name
                      ? `What's on your mind, ${profile.name}?`
                      : "What’s on your mind?"}
                  </h2>
                  <p>
                    {page === "chart" ? "Ask a question, read the interpretation, and expand the calculation evidence behind it. You can follow up in this conversation." : <>A question. A feeling. Something you keep coming back to.<br />You do not need to have it all figured out.</>}
                  </p>
                  <div className="starters">
                    {(page === "chart" ? chartStarters : starters).map((text) => (
                      <button
                        key={text}
                        onClick={() => {
                          setDraft(text);
                          composer.current?.focus();
                        }}
                      >
                        {text}
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="messages">
                  {history.map((message) => (
                    <article className={`message ${message.role}`} key={message.id}>
                      <span className="message-author">
                        {message.role === "user"
                          ? profile.name || "You"
                          : "✧ Iktara"}
                      </span>
                      <div>
                        {message.role === "assistant" ? (
                          <ReactMarkdown skipHtml disallowedElements={["img"]}>
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          message.content
                        )}
                      </div>
                      {message.role === "assistant" && message.evidence && <Evidence evidence={message.evidence} />}
                      {message.role === "assistant" && page === "chart" && !message.evidence && <p className="fine-print">No calculation evidence was saved with this earlier response.</p>}
                      {message.role === "assistant" && <button className="text-button follow-up" disabled={!!busy} onClick={() => composer.current?.focus()}>Ask a follow-up →</button>}
                    </article>
                  ))}
                </div>
              )}
              {busy === "chat" && (
                <p className="thinking" role="status">
                  ✧{" "}
                  {activeJob?.status === "pending"
                    ? "Your question is queued"
                    : "Your companion is working"}
                  <span>…</span>
                </p>
              )}
              <div ref={conversationEnd} />
            </div>
            {error && (
              <div className="feedback error" role="alert">
                {error}
                {failedMessage && <button className="text-button feedback-action" onClick={retry} disabled={!!busy || !ready || (page === "chart" && !chart)}>Retry this question</button>}
              </div>
            )}
            {(!ready || health === "Reconnecting…" || health === "Connection unavailable") && <button className="text-button feedback-action" onClick={reconnect}>Reconnect to saved space</button>}
            {notice && (
              <div className="feedback notice" role="status">
                {notice}
              </div>
            )}
            <form className="composer" onSubmit={send}>
              <label className="sr-only" htmlFor="message">
                Your message to Iktara
              </label>
              <textarea
                ref={composer}
                id="message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={page === "chart" ? !chart ? "Calculate your chart to ask a question…" : "Ask about your chart, or follow up…" : "Start wherever you are…"}
                rows={2}
                maxLength={4000}
                disabled={!ready || !!busy || (page === "chart" && !chart)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    if (draft.trim() && !busy && ready && (page !== "chart" || chart))
                      e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="composer-bottom">
                <span>
                  {page === "chart"
                    ? `${methods.find(([value]) => value === method)?.[1]} · ${domain || "general reading"}`
                    : "A conversation, at your pace"}
                </span>
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!ready || !!busy || !draft.trim() || (page === "chart" && !chart)}
                >
                  ↑
                </button>
              </div>
            </form>
            <p className="conversation-footnote">
              Astrology is a lens for reflection. You decide what resonates.
            </p>
          </section>
        </div>
      </main>
      <footer>
        <span>
          iktara <span aria-hidden="true">✧</span> one string, many
          possibilities.
        </span>
        <span>Made for the wonderfully human.</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
