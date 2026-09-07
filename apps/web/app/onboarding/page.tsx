"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  EMPTY_PROFILE,
  runtimeApi,
  type Profile,
} from "@/app/lib/runtimeApi";
import { Button, Card, Field, Select } from "@/app/components/ui";

const QUALITY_OPTIONS = [
  { value: "exact", label: "I know the exact time" },
  { value: "approximate", label: "It is approximate" },
  { value: "unknown", label: "I do not know my birth time" },
];

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [quality, setQuality] = useState("exact");
  const [birthplace, setBirthplace] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    runtimeApi
      .workspace()
      .then((data) => {
        if (!data.profile) return;
        setName(data.profile.name);
        setDob(data.profile.date_of_birth);
        setTob(data.profile.time_of_birth || "");
        setUnknownTime(data.profile.birth_time_quality === "unknown");
        if (data.profile.birth_time_quality !== "unknown") {
          setQuality(data.profile.birth_time_quality);
        }
        setBirthplace(data.profile.birthplace);
      })
      .catch(() => {
        // The runtime may be offline; the form still loads for editing.
      })
      .finally(() => setLoaded(true));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!dob || !birthplace.trim()) return;
    if (!unknownTime && !tob) {
      setError("Add a birth time or tick “unknown”.");
      return;
    }
    setBusy(true);
    setError("");
    const profile: Profile = {
      ...EMPTY_PROFILE,
      name,
      date_of_birth: dob,
      time_of_birth: unknownTime ? null : tob,
      birthplace,
      birth_time_quality: unknownTime ? "unknown" : (quality as Profile["birth_time_quality"]),
    };
    try {
      await runtimeApi.saveProfile(profile);
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save your birth details.");
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <section>
        <h1 className="page-title">Your birth details</h1>
        <Card>
          <p>Saved. Your details are ready for the chart.</p>
          <div className="row">
            <Button href="/chart" variant="primary">
              Continue to your chart
            </Button>
            <Button href="/chat" variant="ghost">
              Go to chat
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h1 className="page-title">Your birth details</h1>
      <p className="muted">No account needed. Your details stay in this private session.</p>
      <Card>
        <form onSubmit={submit}>
          <Field label="Name (optional)" htmlFor="name">
            <input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Birth date" htmlFor="dob">
            <input id="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} disabled={busy} />
          </Field>
          <Field label="Birth time" htmlFor="tob">
            <input id="tob" type="time" value={tob} disabled={busy || unknownTime} onChange={(e) => setTob(e.target.value)} />
            <label className="check-row">
              <input type="checkbox" checked={unknownTime} disabled={busy} onChange={(e) => setUnknownTime(e.target.checked)} />
              I don&apos;t know my birth time
            </label>
          </Field>
          <Field label="How certain is the time?" htmlFor="quality">
            <Select
              id="quality"
              value={unknownTime ? "unknown" : quality}
              disabled={busy}
              onChange={(value) => {
                if (value === "unknown") setUnknownTime(true);
                else {
                  setUnknownTime(false);
                  setQuality(value);
                }
              }}
              options={QUALITY_OPTIONS}
            />
          </Field>
          <Field label="Birthplace" htmlFor="place">
            <input id="place" required value={birthplace} placeholder="City, country" maxLength={200} onChange={(e) => setBirthplace(e.target.value)} disabled={busy} />
          </Field>
          {error && <p className="error">{error}</p>}
          <Button type="submit" disabled={busy || !loaded}>
            {busy ? "Saving…" : "Save details"}
          </Button>
        </form>
      </Card>
    </section>
  );
}
