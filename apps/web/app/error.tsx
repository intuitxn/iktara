"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
      <p className="note mb-4">{error.message}</p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
