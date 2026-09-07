"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { isActiveJob, runtimeApi } from "@/app/lib/runtimeApi";
import type { Job, Message, Profile, ReadingDomain, ReadingMethod } from "@/app/lib/runtimeApi";
import { Button, Card, Field, Select, StatusPill } from "@/app/components/ui";

const LENS_OPTIONS = [
  { value: "vedic", label: "Vedic" }, { value: "kp", label: "KP" },
  { value: "western", label: "Western" }, { value: "compare", label: "Compare" },
];

const TOPIC_OPTIONS = [
  { value: "general", label: "General" }, { value: "career", label: "Career" },
  { value: "relationships", label: "Relationships" }, { value: "health", label: "Health" },
  { value: "education", label: "Education" }, { value: "money", label: "Finance" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasChart, setHasChart] = useState(false);
  const [draft, setDraft] = useState("");
  const [method, setMethod] = useState<ReadingMethod>("compare");
  const [domain, setDomain] = useState<ReadingDomain>("general");
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    runtimeApi.workspace().then((data) => {
      setMessages(data.messages);
      setProfile(data.profile);
      setHasChart(Boolean(data.chart));
    }).catch((failure) =>
      setError(failure instanceof Error ? failure.message : "Could not load your workspace."),
    );
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  async function poll(id: string) {
    try {
      const current = await runtimeApi.job(id);
      setJob(current);
      if (isActiveJob(current)) {
        pollTimer.current = setTimeout(() => poll(id), 1000);
        return;
      }
      setBusy(false);
      if (current.status === "error") {
        setError(current.error || "This response was interrupted. Please try again.");
        return;
      }
      const data = await runtimeApi.workspace();
      setMessages(data.messages);
      setHasChart(Boolean(data.chart));
    } catch {
      pollTimer.current = setTimeout(() => poll(id), 1000); // runtime restarting; keep polling
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    setDraft("");
    try {
      const result = await runtimeApi.chat({
        message,
        page: hasChart ? "chart" : "reflection",
        requestId: crypto.randomUUID(),
        method,
        domain,
      });
      setJob({ id: result.jobId, page: "chart", status: "pending" });
      void poll(result.jobId);
    } catch (failure) {
      setBusy(false);
      setError(failure instanceof Error ? failure.message : "Your response could not be started.");
    }
  }

  return (
    <section>
      <h1 className="page-title">Chat</h1>
      <div className="stack">
        {profile && (
          <Card>
            <p className="card-meta">
              <span>{profile.name || "Your space"} · {profile.date_of_birth}</span>
              <span>{hasChart ? "chart ready" : "no chart yet"}</span>
            </p>
            <p className="muted">
              {hasChart ? "Questions are answered from your calculated chart." : "Calculate your chart for chart-grounded readings."}
            </p>
            {!hasChart && <Button href="/chart" variant="ghost">Calculate your chart</Button>}
          </Card>
        )}
        {error && <p className="error">{error}</p>}
        {messages.map((item) => (
          <div key={item.id} className={`chat-row chat-row--${item.role === "user" ? "user" : "assistant"}`}>
            <Card variant={item.role === "user" ? "user" : "assistant"}>
              <p className="card-meta">
                <span>{item.role === "user" ? "You" : "Iktara"}</span>
                <span>{item.method ? `${item.method} · ` : ""}{new Date(item.createdAt).toLocaleString()}</span>
              </p>
              <pre className="data">{item.content}</pre>
              {item.evidence && (
                <EvidenceDetails items={item.evidence.items} limitations={item.evidence.limitations} />
              )}
            </Card>
          </div>
        ))}
        {busy && (
          <div className="chat-row chat-row--assistant">
            <Card>
              <StatusPill status={job?.status ?? "pending"} />
            </Card>
          </div>
        )}
        <form onSubmit={send}>
          <Card>
            <div className="row">
              <Field label="Lens" htmlFor="lens">
                <Select id="lens" value={method} disabled={busy}
                  onChange={(value) => setMethod(value as ReadingMethod)} options={LENS_OPTIONS} />
              </Field>
              <Field label="Topic" htmlFor="topic">
                <Select id="topic" value={domain} disabled={busy}
                  onChange={(value) => setDomain(value as ReadingDomain)} options={TOPIC_OPTIONS} />
              </Field>
            </div>
            <Field label="Message" htmlFor="message">
              <textarea id="message" rows={3} value={draft} maxLength={4000} disabled={busy}
                onChange={(e) => setDraft(e.target.value)} placeholder="Ask about your chart…" />
            </Field>
            <Button type="submit" disabled={busy || !draft.trim()}>
              Send
            </Button>
          </Card>
        </form>
      </div>
    </section>
  );
}

function EvidenceDetails({
  items,
  limitations,
}: {
  items: NonNullable<Message["evidence"]>["items"];
  limitations: string[];
}) {
  return (
    <div>
      {items.map((item) => (
        <details className="evidence" key={item.id}>
          <summary>{item.id} · {item.system} · {item.kind}</summary>
          <pre className="data">{JSON.stringify(item.detail, null, 2)}</pre>
        </details>
      ))}
      {limitations.length > 0 && (
        <details className="evidence">
          <summary>Limits of this reading</summary>
          <ul>
            {limitations.map((limit, index) => (
              <li className="muted" key={index}>{limit}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
