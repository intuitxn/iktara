"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, ChevronRight, MessageCircle, Info } from "lucide-react";
import type { Message } from "@/app/lib/runtimeApi";

function label(value: string) {
  if (value.toLowerCase() === "kp") return "KP";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Facts({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>Not supplied</span>;
  if (Array.isArray(value))
    return (
      <ul className="space-y-2">
        {value.map((v, i) => (
          <li key={i}>
            <Facts value={v} />
          </li>
        ))}
      </ul>
    );
  if (typeof value === "object")
    return (
      <dl className="space-y-2">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(80px,1fr)_2fr] gap-3">
            <dt className="text-text-secondary">{label(k)}</dt>
            <dd className="min-w-0 break-words">
              <Facts value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span>
      {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
    </span>
  );
}

export default function ReadingAnswer({
  message,
  onFollowUp,
  disabled,
}: {
  message: Message;
  onFollowUp?: (question: string) => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState("answer");
  const evidence = message.evidence;
  const items = evidence?.items ?? [];
  const reference = (id: string) => `evidence-${message.id}-${id}`;
  const section = message.content.match(
    /(?:^|\n)#{1,3}\s*Explore Further\s*\n([\s\S]*)$/i,
  );
  const questions = section
    ? section[1]
        .split("\n")
        .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
        .filter((l) => l.endsWith("?"))
        .slice(0, 3)
    : [];
  const body =
    questions.length && section
      ? message.content.slice(0, section.index)
      : message.content;
  const citedIds = new Set(
    [...body.matchAll(/\[(E-[a-f0-9]+)\]/g)].map((m) => m[1]),
  );
  const shownItems = [...citedIds].flatMap((id) =>
    items.filter((item) => item.id === id),
  );
  const otherItems = items.filter((item) => !citedIds.has(item.id));
  const orderedItems = [...shownItems, ...otherItems];
  const cited = body.replace(/\[(E-[a-f0-9]+)\]/g, (original, id: string) => {
    const n = orderedItems.findIndex((item) => item.id === id);
    return n < 0 ? original : `[${n + 1}](#${reference(id)})`;
  });
  const sourceCard = (item: (typeof items)[number]) => (
    <details
      key={item.id}
      id={reference(item.id)}
      className="glass-card p-3 target:ring-2 target:ring-accent"
    >
      <summary className="text-xs font-medium text-text-primary">
        <span className="mr-2 text-accent">
          {orderedItems.indexOf(item) + 1}
        </span>
        {label(item.system)} · {label(item.kind)}
      </summary>
      <div className="mt-4 text-xs leading-relaxed">
        <Facts value={item.detail} />
      </div>
    </details>
  );
  return (
    <article className="min-w-0">
      <div className="flex items-center gap-2 mb-4 text-xs text-text-secondary">
        <BookOpen size={15} />
        <span className="font-semibold text-text-primary">Iktara</span>
        {message.method && (
          <span className="rounded-full bg-accent/10 border border-accent/15 px-2.5 py-0.5 text-[10px] font-semibold text-accent uppercase">
            {message.method}
          </span>
        )}
        {message.domain && <span>{label(message.domain)}</span>}
      </div>
      <div className="flex gap-5 border-b border-black/10 mb-5" aria-label="Reading views">
        {([{id:"answer",label:"Answer",Icon:MessageCircle}, ...(evidence ? [{id:"sources",label:`Sources · ${shownItems.length}`,Icon:BookOpen},{id:"details",label:"Details",Icon:Info}] : [])]).map(({id,label,Icon}) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`flex items-center gap-2 py-3 text-sm border-b-2 ${tab === id ? "border-accent text-accent" : "border-transparent text-text-secondary"}`}><Icon size={16}/>{label}</button>
        ))}
      </div>
      <div hidden={tab !== "answer"} className="answer-markdown text-text-primary">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => (
              <a
                href={href}
                onClick={(event) => {
                  if (href?.startsWith("#evidence-")) {
                    event.preventDefault();
                    setTab("sources");
                    requestAnimationFrame(() => {
                      const target = document.getElementById(href.slice(1));
                      if (target instanceof HTMLDetailsElement) {
                        target.open = true;
                        target.scrollIntoView({block:"nearest"});
                        target.querySelector("summary")?.focus();
                      }
                    });
                  }
                }}
              >
                {children}
              </a>
            ),
          }}
        >
          {cited}
        </ReactMarkdown>
      </div>
      {evidence && (
        <div hidden={tab === "answer"} className="mt-5">
          <div hidden={tab !== "sources"}>
          <h3 className="mb-2 text-xs font-semibold text-text-primary">
            Chart sources · {shownItems.length}
          </h3>
          <p className="mb-3 text-xs text-text-secondary">
            Calculated placements and traditional interpretations used for this
            answer.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 items-start">{shownItems.map(sourceCard)}</div>
          {otherItems.length > 0 && (
            <details className="mt-3 text-xs text-text-secondary">
              <summary>All other engine evidence · {otherItems.length}</summary>
              <div className="space-y-2 mt-3">{otherItems.map(sourceCard)}</div>
            </details>
          )}
          </div>
          <div hidden={tab !== "details"}>
          {evidence.limitations.length > 0 && (
            <details className="mt-4 glass-card p-3">
              <summary className="text-xs font-medium">
                Limits of this reading
              </summary>
              <ul className="list-disc pl-4 mt-3 space-y-2 text-xs text-text-secondary">
                {evidence.limitations.map((limit, i) => (
                  <li key={i}>{limit}</li>
                ))}
              </ul>
            </details>
          )}
          <details className="mt-3 text-xs text-text-secondary">
            <summary>Calculation provenance</summary>
            <dl className="mt-2 space-y-2 break-all">
              <div>Birth time: {evidence.birth_time_quality}</div>
              <div>Engine revision: {evidence.engine_revision}</div>
              <div>Chart fingerprint: {evidence.chart_digest}</div>
              <div>Evidence: {evidence.id}</div>
            </dl>
          </details>
          </div>
        </div>
      )}
      {tab === "answer" && questions.length > 0 && onFollowUp && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold">Explore Further</p>
          <div className="flex flex-col gap-2">
            {questions.map((q) => (
              <button
                key={q}
                disabled={disabled || !onFollowUp}
                onClick={() => onFollowUp?.(q)}
                className="flex items-center justify-between gap-3 glass-card px-4 py-3 text-left text-sm text-text-secondary hover:text-accent"
              >
                {q}
                <ChevronRight size={15} className="shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
