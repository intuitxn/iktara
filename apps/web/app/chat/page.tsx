"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, BriefcaseBusiness, Heart, Orbit, Sparkles } from "lucide-react";
import { DOMAINS, isActiveJob, runtimeApi } from "@/app/lib/runtimeApi";
import type {
  Job,
  Message,
  ReadingDomain,
  ReadingMethod,
  Workspace,
} from "@/app/lib/runtimeApi";
import GalaxyLogo from "@/app/components/GalaxyLogo";
import ChatInput from "./components/ChatInput";
import Sidebar from "./components/Sidebar";
import ReadingAnswer from "./components/ReadingAnswer";

const EXAMPLES = [
  { question: "What does my chart say about my career path?", topic: "career", Icon: BriefcaseBusiness },
  { question: "What patterns shape my relationships?", topic: "relationships", Icon: Heart },
  { question: "Where do Vedic and Western readings agree?", topic: "general", Icon: Orbit },
  {
    question: "What are my strongest planetary influences?",
    topic: "personality", Icon: Sparkles,
  },
] as const;

export default function ChatPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [method, setMethod] = useState<ReadingMethod>("compare");
  const [domain, setDomain] = useState<ReadingDomain>("general");
  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  const alive = useRef(true);
  const busy = submitting || Boolean(job && isActiveJob(job));

  const apply = useCallback((data: Workspace) => {
    setWorkspace(data);
    // The API sends newest first, including row order for identical timestamps.
    setMessages(
      data.messages
        .slice()
        .reverse(),
    );
  }, []);

  useEffect(() => {
    alive.current = true;
    runtimeApi
      .workspace()
      .then((data) => {
        if (!alive.current) return;
        apply(data);
        const active = data.jobs.find(
          (j) => isActiveJob(j),
        );
        if (active) {
          setJob(active);
          if (active.method) setMethod(active.method);
          if (active.domain) setDomain(active.domain);
        } else {
          const latest = data.jobs[0];
          if (latest?.status === "error") {
            setJob(latest);
            setError(
              latest.error ||
                "The last reading was interrupted. You can ask again.",
            );
          }
        }
      })
      .catch((failure) => {
        if (alive.current) setError(failure.message);
      })
      .finally(() => {
        if (alive.current) setLoaded(true);
      });
    return () => {
      alive.current = false;
    };
  }, [apply]);

  const activeId = job && isActiveJob(job) ? job.id : null;
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const current = await runtimeApi.job(activeId!);
        if (cancelled) return;
        setReconnecting(false);
        if (isActiveJob(current)) {
          setJob(current);
          timer = setTimeout(poll, 1200);
          return;
        }
        // Load the durable answer before leaving the polling effect.
        const data = await runtimeApi.workspace();
        if (cancelled) return;
        apply(data);
        setJob(current);
        if (current.status === "error")
          setError(
            current.error || "This reading was interrupted. Please try again.",
          );
      } catch {
        if (cancelled) return;
        setReconnecting(true);
        timer = setTimeout(poll, 3000);
      }
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeId, apply]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, busy]);

  async function send(message: string, topic: ReadingDomain = domain) {
    if (busy || submitLock.current || !workspace) return;
    const page = workspace.chart ? "chart" : "reflection";
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    setDraft(message);
    setDomain(topic);
    try {
      const result = await runtimeApi.chat({
        message,
        page,
        requestId: crypto.randomUUID(),
        method,
        domain: topic,
      });
      if (!alive.current) return;
      setJob({
        id: result.jobId,
        page,
        status: "pending",
        method,
        domain: topic,
      });
      setDraft("");
      const data = await runtimeApi.workspace();
      if (alive.current) apply(data);
    } catch (failure) {
      if (alive.current) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Your reading could not be started. Your question is kept below.",
        );
        // A dropped acknowledgement may still have created a durable job.
        try {
          const data = await runtimeApi.workspace();
          if (alive.current) {
            apply(data);
            const active = data.jobs.find(
              (j) => isActiveJob(j),
            );
            if (active) setJob(active);
          }
        } catch {}
      }
    } finally {
      submitLock.current = false;
      if (alive.current) setSubmitting(false);
    }
  }

  const examples = workspace?.chart ? EXAMPLES : [
    {question:"How can I find more clarity in my career?", topic:"career" as const, Icon:BriefcaseBusiness},
    {question:"Help me understand a relationship pattern.", topic:"relationships" as const, Icon:Heart},
  ];

  const composer = (
    <div className="w-full">
      <div hidden={!workspace?.chart} className={workspace?.chart ? "flex justify-end items-center gap-2 mb-2 text-xs text-text-secondary" : "hidden"}>
        <label htmlFor="reading-topic">Topic</label>
        <select
          id="reading-topic"
          className="rounded-lg border border-white/50 bg-white/25 px-2 py-1 max-w-40"
          value={domain}
          disabled={busy}
          onChange={(e) => setDomain(e.target.value as ReadingDomain)}
        >
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <ChatInput
        onSubmit={send}
        isLoading={busy || !loaded || !workspace}
        method={method}
        onMethodChange={(m) => setMethod(m as ReadingMethod)}
        canCompare
        hasChart={Boolean(workspace?.chart)}
        centered={!messages.length}
        draft={draft}
        onDraftChange={setDraft}
      />
      <p className="mt-3 text-center text-[11px] text-text-secondary">
        {workspace?.chart ? "Grounded in your birth chart · Interpretations, not guarantees" : "Start a conversation now. Add your birth chart for a personal astrology reading."}
      </p>
    </div>
  );

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        toggle={() => setSidebarOpen((o) => !o)}
        onQuestion={() => {
          document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
        }}
      />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/25 px-4 pl-16 lg:pl-6">
          <span className="text-sm text-text-secondary">
            iktara
          </span>
          <Link className="text-xs text-accent" href={workspace?.chart ? "/chart" : "/onboarding"}>
            {workspace?.chart ? `${workspace.profile?.name || "Your"} · Birth chart` : "Add birth chart"}
          </Link>
        </header>
        {error && (
          <div
            role="alert"
            className="mx-4 mt-3 rounded-xl bg-white/60 border border-red-800/15 p-3 text-sm text-red-900"
          >
            {error}
            {job?.status === "error" && (
              <button
                className="block mt-2 underline font-medium"
                onClick={() => {
                  const question = messages.findLast(
                    (m) => m.role === "user" && m.jobId === job.id,
                  );
                  if (question) {
                    setDraft(question.content);
                    if (job.method) setMethod(job.method);
                    if (job.domain) setDomain(job.domain);
                    document
                      .querySelector<HTMLTextAreaElement>("textarea")
                      ?.focus();
                  }
                }}
              >
                Restore question to retry
              </button>
            )}
          </div>
        )}
        {!messages.length ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
            <GalaxyLogo size={64} />
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-center">
              {workspace?.profile?.name ? `What’s on your mind, ${workspace.profile.name}?` : "What would you like to understand?"}
            </h1>
            <p className="mt-2 mb-8 max-w-md text-center text-[15px] text-text-secondary leading-relaxed">
              A little more clarity, through conversation and your chart.
            </p>
            <div className="w-full max-w-2xl">{composer}</div>
            {loaded && !workspace?.chart && <Link href="/onboarding" className="mt-4 text-sm text-accent">Add birth details →</Link>}
            <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {examples.map((q) => (
                <button
                  key={q.question}
                  disabled={busy || !workspace}
                  onClick={() => void send(q.question, q.topic)}
                  className="glass-card px-4 py-3 text-left text-sm text-text-secondary hover:text-accent"
                >
                  <q.Icon size={17} className="mb-2 text-accent" />
                  {q.question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-6 lg:px-6">
              <div className="mx-auto max-w-2xl space-y-7">
                {messages.map((m) => (
                  <div id={`message-${m.id}`} key={m.id}>
                    {m.role === "user" ? (
                      <div>
                        <div className="text-2xl font-medium leading-snug whitespace-pre-wrap break-words">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <ReadingAnswer
                        message={m}
                        onFollowUp={(q) => void send(q)}
                        disabled={busy || !workspace}
                      />
                    )}
                  </div>
                ))}
                {busy && (
                  <div
                    role="status"
                    className="glass-card p-4 text-sm text-text-secondary flex items-center gap-3"
                  >
                    <Loader2 className="animate-spin shrink-0" size={16} />
                    {reconnecting
                      ? "Reconnecting to your saved reading…"
                      : job?.status === "running"
                        ? "Preparing your answer…"
                        : "Your question is queued…"}
                  </div>
                )}
                <div ref={end} />
              </div>
            </div>
            <div className="shrink-0 border-t border-white/30 bg-white/15 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-xl">
              <div className="mx-auto max-w-2xl">
                {composer}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
