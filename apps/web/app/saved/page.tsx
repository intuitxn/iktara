"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { runtimeApi, type Message } from "@/app/lib/runtimeApi";
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
        setError(failure instanceof Error ? failure.message : "Could not load saved messages."),
      )
      .finally(() => setLoaded(true));
  }, []);

  async function reset() {
    if (!window.confirm("Delete the birth details, chart, and conversations in this workspace?")) return;
    setBusy(true);
    setError("");
    try {
      await runtimeApi.reset();
      setMessages([]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your data could not be cleared.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="page-title">Saved</h1>
      <div className="stack">
        {error && <p className="error">{error}</p>}
        {!loaded ? (
          <p className="muted">Loading…</p>
        ) : messages.length === 0 ? (
          <Card>
            <p className="muted">No readings yet. Ask a question in chat and it will appear here.</p>
            <Button href="/chat" variant="primary">New reading</Button>
          </Card>
        ) : (
          messages.map((item) => (
            <Link key={item.id} href="/chat" className="card card-link">
              <p className="card-meta">
                <span>{item.role === "user" ? "You" : "Iktara"}</span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </p>
              <p className="muted">
                {item.content.length > 200 ? `${item.content.slice(0, 200)}…` : item.content}
              </p>
            </Link>
          ))
        )}
        <div className="row">
          <Button href="/chat" variant="primary">New reading</Button>
          {messages.length > 0 && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              {busy ? "Clearing…" : "Reset workspace"}
            </Button>
          )}
        </div>
        <p className="muted">Your workspace is kept on this server for this private session.</p>
      </div>
    </section>
  );
}
