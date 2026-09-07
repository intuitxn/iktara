"use client";

import { Button } from "@/app/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section>
      <h1 className="page-title">Something went wrong</h1>
      <p className="error">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
