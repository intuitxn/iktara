import { Button } from "@/app/components/ui";

export default function Home() {
  return (
    <section className="hero">
      <h1 className="hero-title">
        iktara<span className="hero-dot">.</span>
      </h1>
      <p className="tagline">A little closer to yourself</p>
      <p className="muted">
        Birth details → your chart → readings. No account, just your space.
      </p>
      <Button href="/onboarding" variant="primary">
        Start with your birth details
      </Button>
    </section>
  );
}
