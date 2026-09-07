"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DOMAINS, METHODS, isActiveJob, runtimeApi } from "@/app/lib/runtimeApi";
import type { Job, Message, Profile, ReadingDomain, ReadingMethod } from "@/app/lib/runtimeApi";

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
    <section className="flex min-h-[70vh] flex-col">
      <h1 className="mb-4 text-2xl font-bold">Chat</h1>
      {profile && (
        <p className="note mb-4">
          Reading for {profile.name || "you"} · {profile.date_of_birth}
          {hasChart ? "" : " · no chart computed yet"}
        </p>
      )}
      {error && <p className="error mb-4">{error}</p>}
      <div className="card grow space-y-4">
        {messages.length === 0 && !busy && <p className="note">Ask a question to start a reading.</p>}
        {messages.map((item) => (
          <div key={item.id}>
            <p className="mb-1 text-xs font-semibold">
              {item.role === "user" ? "You" : "Iktara"}
              {item.method ? ` · ${item.method}` : ""}
              {item.domain && item.domain !== "general" ? ` · ${item.domain}` : ""}
            </p>
            <pre className="whitespace-pre-wrap text-sm">{item.content}</pre>
            {item.evidence && <EvidenceDetails evidence={item.evidence} />}
          </div>
        ))}
        {busy && (
          <p className="note">
            {job?.status === "pending" ? "Your question is queued…" : "Your companion is working…"}
          </p>
        )}
      </div>
      <form onSubmit={send} className="card mt-4">
        <div className="field">
          <textarea rows={3} value={draft} maxLength={4000} disabled={busy}
            onChange={(e) => setDraft(e.target.value)} placeholder="Ask about your chart…" />
        </div>
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="field mb-0 w-40">
            <label htmlFor="method">Method</label>
            <select id="method" value={method} disabled={busy}
              onChange={(e) => setMethod(e.target.value as ReadingMethod)}>
              {METHODS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="field mb-0 grow">
            <label htmlFor="domain">Topic</label>
            <select id="domain" value={domain} disabled={busy}
              onChange={(e) => setDomain(e.target.value as ReadingDomain)}>
              {DOMAINS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

function EvidenceDetails({ evidence }: { evidence: NonNullable<Message["evidence"]> }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="note cursor-pointer">Calculation evidence ({evidence.items.length} items)</summary>
      {evidence.limitations.length > 0 && (
        <ul className="note mt-2 list-disc pl-5">
          {evidence.limitations.map((limit, index) => <li key={index}>{limit}</li>)}
        </ul>
      )}
      <pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(evidence.items, null, 2)}</pre>
    </details>
  );
}
