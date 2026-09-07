"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { runtimeApi, type Message } from "@/app/lib/runtimeApi";

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
        failure instanceof Error ? failure.message : "Your data could not be cleared.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">Saved</h1>
      <p className="note mb-4">Every conversation is saved with your workspace.</p>
      {error && <p className="error mb-4">{error}</p>}
      {!loaded ? (
        <p className="note">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="note">
          No messages yet. Ask a question in chat and it will appear here.
        </p>
      ) : (
        <div className="space-y-2">
          {messages.map((messageItem) => (
            <Link key={messageItem.id} href="/chat" className="card block">
              <p className="mb-1 text-xs font-semibold">
                {messageItem.role} ·{" "}
                {new Date(messageItem.createdAt).toLocaleString()}
              </p>
              <p className="note">
                {messageItem.content.length > 200
                  ? `${messageItem.content.slice(0, 200)}…`
                  : messageItem.content}
              </p>
            </Link>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <button className="btn mt-4" onClick={reset} disabled={busy}>
          {busy ? "Clearing…" : "Clear workspace"}
        </button>
      )}
    </section>
  );
}
