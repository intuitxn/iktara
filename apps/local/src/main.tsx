import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./style.css";

type Profile = {
  name: string;
  date_of_birth: string;
  time_of_birth: string | null;
  birthplace: string;
  birth_time_quality: string;
};
type Message = { role: "user" | "assistant"; content: string };
type Planet = { name: string; sign: string; sign_degree: number };
type Chart = {
  tropical_planets?: Planet[];
  sidereal_planets?: Planet[];
  ascendant_tropical?: number;
  birth_time_quality?: string;
  [key: string]: unknown;
};
type ChartResult = { chart: Chart; display_name: string; timezone: string };
type Saved = {
  profile: Profile;
  chart: ChartResult | null;
  history: Message[];
};
const emptyProfile: Profile = {
  name: "",
  date_of_birth: "",
  time_of_birth: "",
  birthplace: "",
  birth_time_quality: "exact",
};
const storageKey = "iktara.local.v1";
function restore(): Saved {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      value &&
      typeof value.profile?.birthplace === "string" &&
      Array.isArray(value.history)
    ) {
      return {
        profile: { ...emptyProfile, ...value.profile },
        chart: value.chart?.chart ? value.chart : null,
        history: value.history
          .filter(
            (m: Message) =>
              ["user", "assistant"].includes(m.role) &&
              typeof m.content === "string",
          )
          .slice(-60),
      };
    }
  } catch {
    /* A private browser or old saved data should not prevent opening the app. */
  }
  return { profile: emptyProfile, chart: null, history: [] };
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : typeof data.detail === "string"
          ? data.detail
          : "Something interrupted the connection. Please try again.",
    );
  return data as T;
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
  const [saved] = useState(restore);
  const [profile, setProfile] = useState(saved.profile);
  const [chart, setChart] = useState<ChartResult | null>(saved.chart);
  const [history, setHistory] = useState<Message[]>(saved.history);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"chart" | "chat" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState("Connecting");
  const [editing, setEditing] = useState(!saved.chart);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const generation = useRef(0);

  useEffect(() => {
    fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setHealth(
          data.ok === false ? "Service needs attention" : "Local space",
        );
      })
      .catch(() => setHealth("Connection unavailable"));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ profile, chart, history }),
      );
    } catch {
      setNotice(
        "Browser storage is unavailable. This conversation will last for this visit.",
      );
    }
  }, [profile, chart, history]);
  useEffect(() => {
    if (history.length)
      conversationEnd.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [history, busy]);

  function update(key: keyof Profile, value: string) {
    setProfile((previous) => ({ ...previous, [key]: value }));
    setChart(null);
  }
  async function compute(event: React.FormEvent) {
    event.preventDefault();
    setBusy("chart");
    setError("");
    setNotice("");
    const turn = generation.current;
    try {
      const result = await post<ChartResult>("/api/chart", {
        ...profile,
        time_of_birth:
          profile.birth_time_quality === "unknown"
            ? null
            : profile.time_of_birth || null,
      });
      if (!result.chart)
        throw new Error("Your chart could not be read. Please try again.");
      if (turn === generation.current) {
        setChart(result);
        setEditing(false);
        setNotice("Your chart is ready. Start with whatever is on your mind.");
      }
    } catch (failure) {
      if (turn === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Your chart could not be calculated.",
        );
    } finally {
      if (turn === generation.current) setBusy(null);
    }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const previous = history;
    const turn = generation.current;
    setHistory([...previous, { role: "user", content: message }]);
    setDraft("");
    setBusy("chat");
    setError("");
    setNotice("");
    try {
      const result = await post<{ text: string }>("/api/chat", {
        message,
        profile:
          profile.date_of_birth && profile.birthplace
            ? { ...profile, time_of_birth: profile.time_of_birth || null }
            : null,
        chart: chart?.chart,
        history: previous.slice(-20),
      });
      if (typeof result.text !== "string" || !result.text.trim())
        throw new Error("No answer came back. Please try again.");
      if (turn === generation.current)
        setHistory((current) => [
          ...current,
          { role: "assistant", content: result.text },
        ]);
    } catch (failure) {
      if (turn === generation.current) {
        setHistory(previous);
        setDraft(message);
        setError(
          failure instanceof Error
            ? failure.message
            : "The conversation is temporarily unavailable.",
        );
      }
    } finally {
      if (turn === generation.current) setBusy(null);
    }
  }
  function clear() {
    if (
      !window.confirm(
        "Clear your saved birth details, chart, and conversation from this browser?",
      )
    )
      return;
    generation.current += 1;
    setProfile({ ...emptyProfile });
    setChart(null);
    setHistory([]);
    setDraft("");
    setBusy(null);
    setError("");
    setEditing(true);
    setNotice(
      "Your saved details and conversation have been cleared from this browser.",
    );
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* State is cleared even when browser storage is unavailable. */
    }
  }
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
          <aside className="profile-panel">
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
                    disabled={!!busy}
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
                  onClick={() => composer.current?.focus()}
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
                No account needed. Details and conversation are saved in this
                browser. Messages and any chart context you add are sent for AI
                processing.
              </p>
            </div>
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
                02 <span>A SPACE TO REFLECT</span>
              </div>
              <span className="small-star" aria-hidden="true">
                ✧
              </span>
            </div>
            <div
              className="conversation"
              aria-live="polite"
              aria-busy={busy === "chat"}
            >
              {!history.length ? (
                <div className="empty-conversation">
                  <div className="conversation-symbol" aria-hidden="true">
                    ✧
                  </div>
                  <h2>
                    {profile.name
                      ? `What's on your mind, ${profile.name}?`
                      : "What’s on your mind?"}
                  </h2>
                  <p>
                    A question. A feeling. Something you keep coming back to.
                    <br />
                    You do not need to have it all figured out.
                  </p>
                  <div className="starters">
                    {starters.map((text) => (
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
                  {history.map((message, index) => (
                    <article className={`message ${message.role}`} key={index}>
                      <span className="message-author">
                        {message.role === "user"
                          ? profile.name || "You"
                          : "✧ Iktara"}
                      </span>
                      <div>{message.content}</div>
                    </article>
                  ))}
                </div>
              )}
              {busy === "chat" && (
                <p className="thinking" role="status">
                  ✧ Taking a moment with your question<span>…</span>
                </p>
              )}
              <div ref={conversationEnd} />
            </div>
            {error && (
              <div className="feedback error" role="alert">
                {error}
              </div>
            )}
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
                placeholder="Start wherever you are…"
                rows={2}
                maxLength={4000}
                disabled={!!busy}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    if (draft.trim() && !busy)
                      e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <div className="composer-bottom">
                <span>
                  {chart
                    ? "Your chart is part of this conversation"
                    : "A conversation, at your pace"}
                </span>
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!!busy || !draft.trim()}
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
