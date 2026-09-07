"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function Button({
  href,
  variant = "primary",
  type,
  disabled,
  onClick,
  children,
}: {
  href?: string;
  variant?: "primary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = variant === "primary" ? "btn btn--primary" : "btn btn--ghost";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function Card({
  variant = "default",
  children,
}: {
  variant?: "default" | "user" | "assistant";
  children: ReactNode;
}) {
  const className = variant === "default" ? "card" : `card card--${variant}`;
  return <div className={className}>{children}</div>;
}

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function Select({
  id,
  value,
  onChange,
  disabled,
  options,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      id={id}
      className="select"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function StatusPill({
  status,
}: {
  status: "pending" | "running" | "completed" | "error";
}) {
  return (
    <span className={`pill pill--${status}`}>
      <span className="pill-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/chart", label: "Chart" },
  { href: "/chat", label: "Chat" },
  { href: "/saved", label: "Saved" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Main">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "nav-link nav-link--active" : "nav-link"}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
