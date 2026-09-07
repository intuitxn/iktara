import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/app/components/ui";

export const metadata: Metadata = {
  title: "iktara",
  description:
    "A little space to understand yourself — astrology and thoughtful conversation, without an account.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="wordmark">
              iktara<span className="wordmark-dot">.</span>
            </Link>
            <Nav />
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          Astrology and thoughtful conversation — no account needed.
        </footer>
      </body>
    </html>
  );
}
