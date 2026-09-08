"use client";

import Link from "next/link";
import { Bookmark, LayoutGrid, Menu, Plus, Settings, X } from "lucide-react";
import GalaxyLogo from "@/app/components/GalaxyLogo";
import type { Message } from "@/app/lib/runtimeApi";

export default function Sidebar({
  open,
  toggle,
  messages,
  onQuestion,
}: {
  open: boolean;
  toggle: () => void;
  messages: Message[];
  onQuestion: () => void;
}) {
  return (
    <>
      <button
        onClick={toggle}
        className="fixed left-3 top-3 z-50 rounded-xl bg-white/60 p-2 text-text-primary backdrop-blur-md border border-white/40 lg:hidden"
        aria-label={open ? "Close sidebar" : "Open sidebar"}
        aria-expanded={open}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <button
          aria-label="Close sidebar overlay"
          onClick={toggle}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        aria-label="Reading navigation"
        className={`fixed left-0 top-0 z-40 flex h-dvh w-[260px] shrink-0 flex-col glass-panel transition-transform duration-300 lg:relative lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full invisible lg:visible"}`}
      >
        <Link
          href="/"
          className="flex items-center gap-2 px-4 pt-16 pb-4 lg:pt-5"
        >
          <GalaxyLogo size={32} />
          <span className="text-lg font-semibold tracking-tight">iktara</span>
        </Link>
        <div className="px-3 pb-4">
          <button
            onClick={() => {
              onQuestion();
              if (open) toggle();
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-white/40 bg-white/25 px-3 py-2.5 text-sm font-medium hover:bg-white/40"
          >
            <Plus size={16} />
            Ask a question
          </button>
        </div>
        <nav className="space-y-1 px-3">
          {[
            { href: "/chart", text: "My birth chart", Icon: LayoutGrid },
            { href: "/saved", text: "Saved readings", Icon: Bookmark },
            { href: "/onboarding", text: "Birth details", Icon: Settings },
          ].map(({ href, text, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/30 hover:text-text-primary"
            >
              <Icon size={17} />
              {text}
            </Link>
          ))}
        </nav>
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-3">
          <p className="px-3 mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Recent questions
          </p>
          {messages
            .filter((m) => m.role === "user")
            .slice()
            .reverse()
            .slice(0, 15)
            .map((m) => (
              <a
                href={`#message-${m.id}`}
                onClick={() => {
                  if (open) toggle();
                }}
                key={m.id}
                className="block truncate rounded-lg px-3 py-2 text-xs text-text-secondary hover:bg-white/30"
              >
                {m.content}
              </a>
            ))}
          {!messages.length && (
            <p className="px-3 text-xs text-text-secondary">
              Your questions will appear here.
            </p>
          )}
        </div>
        <div className="border-t border-white/30 p-5 text-xs text-text-secondary">
          <p className="font-medium text-text-primary mb-1">
            Your private space
          </p>
          <p>Readings stay in this browser’s workspace. No signup needed.</p>
        </div>
      </aside>
    </>
  );
}
