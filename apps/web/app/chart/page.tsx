"use client";

import { useEffect, useState } from "react";
import { runtimeApi, type ChartResult, type Profile } from "@/app/lib/runtimeApi";
import { Button, Card, SectionTitle } from "@/app/components/ui";

type PlanetRow = { name: string; sign: string; sign_degree: number };

export default function ChartPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    runtimeApi
      .workspace()
      .then((data) => {
        setProfile(data.profile);
        setChart(data.chart);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function compute() {
    if (!profile || busy) return;
    setBusy(true);
    setError("");
    try {
      setChart(await runtimeApi.computeChart(profile));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your chart could not be calculated.");
    } finally {
      setBusy(false);
    }
  }

  const tropical = (chart?.chart.tropical_planets as PlanetRow[] | undefined) ?? [];
  const sidereal = (chart?.chart.sidereal_planets as PlanetRow[] | undefined) ?? [];

  if (!loaded) return <p className="muted">Loading…</p>;

  if (!profile) {
    return (
      <section>
        <h1 className="page-title">Your chart</h1>
        <Card>
          <p className="muted">Add your birth details first.</p>
          <Button href="/onboarding" variant="primary">
            Go to onboarding
          </Button>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h1 className="page-title">Your chart</h1>
      <div className="stack">
        <Card>
          <p className="card-meta">
            <span>{profile.name || "Birth details"}</span>
            <span>{profile.birth_time_quality}</span>
          </p>
          <p>
            {profile.date_of_birth} · {profile.time_of_birth || "time unknown"} ·{" "}
            {profile.birthplace}
          </p>
          {chart && <p className="muted">{chart.display_name} · {chart.timezone}</p>}
          {!chart && (
            <Button onClick={compute} disabled={busy}>
              {busy ? "Calculating…" : "Calculate chart"}
            </Button>
          )}
        </Card>
        {error && <p className="error">{error}</p>}
        {chart && (
          <Card>
            <SectionTitle>Planets — tropical</SectionTitle>
            {tropical.length > 0 ? (
              <div className="planets-grid">
                {tropical.map((planet) => (
                  <div className="planet-card" key={planet.name}>
                    <p className="planet-name">{planet.name}</p>
                    <p className="planet-value">
                      {planet.sign} {planet.sign_degree?.toFixed(2)}°
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No tropical planets returned.</p>
            )}
            <SectionTitle>Planets — sidereal</SectionTitle>
            {sidereal.length > 0 ? (
              <div className="planets-grid">
                {sidereal.map((planet) => (
                  <div className="planet-card" key={planet.name}>
                    <p className="planet-name">{planet.name}</p>
                    <p className="planet-value">
                      {planet.sign} {planet.sign_degree?.toFixed(2)}°
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No sidereal planets returned.</p>
            )}
          </Card>
        )}
        {chart && (
          <details className="data">
            <summary>Raw chart data</summary>
            <pre className="data">{JSON.stringify(chart, null, 2)}</pre>
          </details>
        )}
      </div>
    </section>
  );
}
