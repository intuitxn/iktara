"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  EMPTY_PROFILE,
  normalizeProfile,
  runtimeApi,
  type Profile,
} from "@/app/lib/runtimeApi";

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    runtimeApi
      .workspace()
      .then((data) => {
        if (data.profile) setProfile({ ...EMPTY_PROFILE, ...data.profile });
      })
      .catch(() => {
        // The runtime may be offline; the form still loads for editing.
      })
      .finally(() => setLoaded(true));
  }, []);

  const update = (key: keyof Profile, value: string) =>
    setProfile((previous) => ({ ...previous, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!profile.date_of_birth || !profile.birthplace.trim()) return;
    if (profile.birth_time_quality !== "unknown" && !profile.time_of_birth) {
      setError("Add a birth time or mark it as unknown.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await runtimeApi.saveProfile(normalizeProfile(profile));
      router.push("/chart");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save your birth details.",
      );
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">Your birth details</h1>
      <p className="note mb-6">
        No account needed. Your details stay in this private session.
      </p>
      <form onSubmit={submit} className="card max-w-md">
        <div className="field">
          <label htmlFor="name">Name (optional)</label>
          <input
            id="name"
            value={profile.name}
            maxLength={80}
            onChange={(e) => update("name", e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="dob">Birth date</label>
          <input
            id="dob"
            type="date"
            required
            value={profile.date_of_birth}
            onChange={(e) => update("date_of_birth", e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="tob">Birth time</label>
          <input
            id="tob"
            type="time"
            value={profile.time_of_birth || ""}
            required={profile.birth_time_quality !== "unknown"}
            disabled={busy || profile.birth_time_quality === "unknown"}
            onChange={(e) => update("time_of_birth", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="quality">How certain is the time?</label>
          <select
            id="quality"
            value={profile.birth_time_quality}
            onChange={(e) => update("birth_time_quality", e.target.value)}
            disabled={busy}
          >
            <option value="exact">I know the exact time</option>
            <option value="approximate">It is approximate</option>
            <option value="unknown">I do not know my birth time</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="place">Birthplace</label>
          <input
            id="place"
            required
            value={profile.birthplace}
            placeholder="City, country"
            maxLength={200}
            onChange={(e) => update("birthplace", e.target.value)}
            disabled={busy}
          />
        </div>
        {error && <p className="error mb-4">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !loaded}>
          {busy ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </section>
  );
}
