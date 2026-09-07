import Link from "next/link";

export default function Home() {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">iktara</h1>
      <p className="note mb-6">
        Personalized astrology readings from your birth chart.
      </p>
      <Link href="/onboarding" className="btn btn-primary">
        Get started
      </Link>
    </section>
  );
}
