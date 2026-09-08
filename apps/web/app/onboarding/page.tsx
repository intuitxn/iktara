"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GalaxyLogo from "@/app/components/GalaxyLogo";
import { EMPTY_PROFILE, runtimeApi, type Profile } from "@/app/lib/runtimeApi";
import { Button, Card, Field, Select } from "@/app/components/ui";

const QUALITY_OPTIONS = [
  { value: "exact", label: "I know the exact time" },
  { value: "approximate", label: "It is approximate" },
  { value: "unknown", label: "I do not know my birth time" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [tob, setTob] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [quality, setQuality] = useState("exact");
  const [birthplace, setBirthplace] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
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
      setError("Add a birth time or choose “I do not know my birth time”.");
      return;
    }
    setBusy(true);
    setError("");
    const profile: Profile = {
      ...EMPTY_PROFILE,
      name: name.trim(),
      date_of_birth: dob,
      time_of_birth: unknownTime ? null : tob,
      birthplace: birthplace.trim(),
      birth_time_quality: unknownTime
        ? "unknown"
        : (quality as Profile["birth_time_quality"]),
    };
    try {
      await runtimeApi.saveProfile(profile);
      await runtimeApi.computeChart(profile);
      router.push("/chat");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save your birth details.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-frame">
      <Link href="/chat" className="text-sm text-accent">
        ← Back to Iktara
      </Link>
      <div className="mt-6">
        <GalaxyLogo size={56} />
      </div>
      <h1 className="page-title">Your birth details</h1>
      <p className="muted mb-6">
        A few details to map your sky. No account needed.
      </p>
      <Card>
        <form onSubmit={submit}>
          <Field label="Name (optional)" htmlFor="name">
            <input
              id="name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="Birth date" htmlFor="dob">
            <input
              id="dob"
              type="date"
              max={new Date().toLocaleDateString("en-CA")}
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="Birth time" htmlFor="tob">
            <input
              id="tob"
              type="time"
              value={tob}
              disabled={busy || unknownTime}
              onChange={(e) => setTob(e.target.value)}
            />
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
            <input
              id="place"
              required
              value={birthplace}
              placeholder="City, country"
              maxLength={200}
              onChange={(e) => setBirthplace(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-text-secondary">
              Include the state and country to distinguish places with the same
              name.
            </p>
          </Field>
          {error && <p className="error">{error}</p>}
          <Button type="submit" disabled={busy || !loaded}>
            {busy ? "Calculating your chart…" : "Save chart & continue chatting"}
          </Button>
          <p className="mt-5 text-xs text-text-secondary leading-relaxed">
            Your birthplace is looked up to calculate the chart. Questions and
            relevant chart context go to the AI provider for your reading. Your
            workspace is stored on this server and accessed through this
            browser.
          </p>
        </form>
      </Card>
    </section>
  );
}
