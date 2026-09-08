"use client";

import Link from "next/link";
import { Bookmark, LayoutGrid, Menu, Plus, Settings, X } from "lucide-react";
import GalaxyLogo from "@/app/components/GalaxyLogo";

export default function Sidebar({
  open,
  toggle,
  onQuestion,
}: {
  open: boolean;
  toggle: () => void;
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
        className={`fixed left-0 top-0 z-40 flex h-dvh w-[200px] lg:w-[88px] shrink-0 flex-col glass-panel transition-transform duration-300 lg:relative lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full invisible lg:visible"}`}
      >
        <Link
          href="/"
          className="flex items-center gap-2 px-4 pt-16 pb-4 lg:pt-5 lg:justify-center"
        >
          <GalaxyLogo size={32} />
          <span className="text-lg font-semibold tracking-tight lg:hidden">iktara</span>
        </Link>
        <div className="px-3 pb-4">
          <button
            onClick={() => {
              onQuestion();
              if (open) toggle();
            }}
            title="Ask a question" aria-label="Ask a question"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/25 px-3 py-2.5 text-sm font-medium hover:bg-white/40"
          >
            <Plus size={16} />
            <span className="lg:hidden">Ask a question</span>
          </button>
        </div>
        <nav className="space-y-1 px-3">
          {[
            { href: "/chart", text: "Chart", Icon: LayoutGrid },
            { href: "/saved", text: "History", Icon: Bookmark },
            { href: "/onboarding", text: "Profile", Icon: Settings },
          ].map(({ href, text, Icon }) => (
            <Link
              key={href}
              href={href}
              title={text}
              className="flex items-center gap-3 lg:flex-col lg:gap-1 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/30 hover:text-text-primary"
            >
              <Icon size={17} />
              <span className="lg:text-[10px] lg:text-center">{text}</span>
            </Link>
          ))}
        </nav>
        <div className="flex-1" />

      </aside>
    </>
  );
}
