import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iktara · Personalized Astrology AI",
  description:
    "Perplexity for astrology, personalized to your birth chart. Explore Vedic, KP and Western readings with traceable chart evidence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
