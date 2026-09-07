"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  runtimeApi,
  type ChartResult,
  type Profile,
} from "@/app/lib/runtimeApi";

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
      setError(
        failure instanceof Error
          ? failure.message
          : "Your chart could not be calculated.",
      );
    } finally {
      setBusy(false);
    }
  }

  const planets = (chart?.chart.tropical_planets as PlanetRow[] | undefined) ?? [];

  if (!loaded) return <p className="note">Loading…</p>;

  if (!profile) {
    return (
      <section>
        <h1 className="mb-2 text-2xl font-bold">Your chart</h1>
        <p className="note mb-4">Add your birth details first.</p>
        <Link href="/onboarding" className="btn btn-primary">
          Go to onboarding
        </Link>
      </section>
    );
  }

  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">Your chart</h1>
      <p className="note mb-4">
        {profile.name || "Birth details"}: {profile.date_of_birth} ·{" "}
        {profile.time_of_birth || "time unknown"} · {profile.birthplace}
      </p>
      {error && <p className="error mb-4">{error}</p>}
      {!chart ? (
        <button className="btn btn-primary" onClick={compute} disabled={busy}>
          {busy ? "Computing…" : "Compute chart"}
        </button>
      ) : (
        <>
          <div className="card">
            <p className="font-semibold">{chart.display_name}</p>
            <p className="note">Timezone: {chart.timezone}</p>
          </div>
          {planets.length > 0 && (
            <div className="card">
              <h2 className="mb-2 font-semibold">Planets (tropical)</h2>
              <ul className="note">
                {planets.map((planet) => (
                  <li key={planet.name}>
                    {planet.name}: {planet.sign} {planet.sign_degree?.toFixed(2)}°
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className="card">
            <summary className="cursor-pointer font-semibold">Raw chart data</summary>
            <pre className="mt-3 overflow-x-auto text-xs">
              {JSON.stringify(chart, null, 2)}
            </pre>
          </details>
        </>
      )}
    </section>
  );
}
