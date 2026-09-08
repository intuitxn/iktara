"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { runtimeApi, type Message } from "@/app/lib/runtimeApi";
import ReadingAnswer from "@/app/chat/components/ReadingAnswer";
import { Button, Card } from "@/app/components/ui";

export default function SavedPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    runtimeApi
      .workspace()
      .then((data) => setMessages(data.messages))
      .catch((failure) =>
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not load saved messages.",
        ),
      )
      .finally(() => setLoaded(true));
  }, []);

  async function reset() {
    if (
      !window.confirm(
        "Delete the birth details, chart, and conversations in this workspace?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await runtimeApi.reset();
      setMessages([]);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your data could not be cleared.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-frame">
      <Link href="/chat" className="text-sm text-accent">
        ← Back to chat
      </Link>
      <h1 className="page-title">Saved readings</h1>
      <div className="stack">
        {error && <p className="error">{error}</p>}
        {!loaded ? (
          <p className="muted">Loading…</p>
        ) : messages.filter((m) => m.role === "assistant" && m.page === "chart")
            .length === 0 ? (
          <Card>
            <p className="muted">
              No readings yet. Ask a question in chat and it will appear here.
            </p>
            <Button href="/chat" variant="primary">
              New reading
            </Button>
          </Card>
        ) : (
          messages
            .filter((m) => m.role === "assistant" && m.page === "chart")
            .map((item) => (
              <details key={item.id} className="card">
                <summary className="text-sm font-medium">
                  {messages.find(
                    (m) => m.jobId === item.jobId && m.role === "user",
                  )?.content || "Your reading"}
                  <span className="block mt-2 text-xs font-normal text-text-secondary">
                    {item.method} · {new Date(item.createdAt).toLocaleString()}
                  </span>
                </summary>
                <div className="mt-5">
                  <ReadingAnswer message={item} />
                  <Link
                    href={`/chat#message-${item.id}`}
                    className="btn btn--ghost mt-5"
                  >
                    Continue in chat
                  </Link>
                </div>
              </details>
            ))
        )}
        <div className="row">
          <Button href="/chat" variant="primary">
            New reading
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              {busy ? "Clearing…" : "Reset workspace"}
            </Button>
          )}
        </div>
        <p className="muted">
          Answers are saved automatically in your browser’s workspace. Clearing
          browser cookies loses access.
        </p>
      </div>
    </section>
  );
}
