"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MapPin, Search, Sparkles, UserRound } from "lucide-react";
import { EMPTY_PROFILE, runtimeApi, type Profile, type BirthLocation } from "@/app/lib/runtimeApi";
import { Button, Card, Field, Select } from "@/app/components/ui";

export default function OnboardingPage() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [places, setPlaces] = useState<BirthLocation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [username, setUsername] = useState("");
  const [savedName, setSavedName] = useState(false);
  useEffect(() => {
    runtimeApi.workspace().then(data => {
      if (data.profile) setProfile(data.profile);
    }).catch(() => setError("Could not load your saved details. Reload before editing them.")).finally(() => setLoaded(true));
  }, []);
  const update = (part: Partial<Profile>) => setProfile(p => ({...p,...part}));
  async function search() {
    if (searching || busy || profile.birthplace.trim().length < 2) return;
    setSearching(true); setError(""); setPlaces([]);
    try {
      const result = await runtimeApi.places(profile.birthplace.trim());
      setPlaces(result.places);
      if (!result.places.length) setError("No matching birthplace. Try the nearest city with its state and country.");
    } catch (e) { setError(e instanceof Error ? e.message : "Birthplace search failed. Please retry."); }
    finally { setSearching(false); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy || searching) return;
    if (!profile.location) { setError("Search for your birthplace and select the correct result first."); return; }
    if (profile.birth_time_quality !== "unknown" && !profile.time_of_birth) { setError("Enter your birth time or choose the unknown-time option."); return; }
    setBusy(true); setError("");
    try {
      // Save atomically only after successful calculation; a failed edit keeps the old chart.
      const result = await runtimeApi.computeChart({...profile,name:profile.name.trim(),time_of_birth:profile.birth_time_quality === "unknown" ? null : profile.time_of_birth});
      const saved = result.profile || profile;
      setProfile(saved); setUsername(saved.username || ""); setCreated(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Your chart could not be created. Your details are kept here."); }
    finally { setBusy(false); }
  }
  async function saveUsername() {
    setBusy(true);setError("");setSavedName(false);
    try { const data = await runtimeApi.saveProfile({...profile,username}); setProfile(data.profile!);setSavedName(true); }
    catch(e) {setError(e instanceof Error ? e.message : "Could not save the username.");}
    finally {setBusy(false);}
  }
  if (created) return <section className="page-frame animate-fade-in">
    <Card><CheckCircle2 className="text-accent mb-4" size={36}/><h1 className="page-title">Your sky is ready, {profile.name}.</h1>
      <p className="muted mb-6">Your birth chart is saved. Here’s your Iktara username to make this space yours.</p>
      <Field label="Your username" htmlFor="username"><div className="flex items-center gap-2"><span>@</span><input id="username" maxLength={30} value={username} onChange={e=>{setUsername(e.target.value.toLowerCase());setSavedName(false);}} disabled={busy}/></div></Field>
      <Button onClick={saveUsername} disabled={busy || username === profile.username}>Save username</Button>
      {savedName && <p role="status" className="text-sm text-accent mt-3">Username saved.</p>}
      {error && <p role="alert" className="error mt-3">{error}</p>}
      <p className="text-xs muted mt-4">This is your display identity, not a login. Keep using this browser to return to your saved chart.</p>
      <div className="row mt-6"><Button href="/chart" variant="primary">Explore my chart</Button><Button href="/chat">Start chatting</Button></div>
    </Card>
  </section>;
  return <section className="page-frame animate-fade-in">
    <Link href="/chat" className="text-sm text-accent">← Back to chat</Link>
    <div className="flex items-center gap-3 mt-7"><Sparkles className="text-accent"/><h1 className="page-title">Make this sky yours</h1></div>
    <p className="muted mb-6">A name, a moment and a place. We’ll calculate your chart and give you a username. No email or phone number required.</p>
    <Card><form onSubmit={submit} aria-busy={busy}>
      <div className="flex items-center gap-2 text-sm font-medium mb-5"><UserRound size={17}/> Your birth profile</div>
      <Field label="What should we call you?" htmlFor="name"><input id="name" autoComplete="given-name" required maxLength={80} value={profile.name} onChange={e=>update({name:e.target.value})} disabled={busy || !loaded}/></Field>
      <div className="grid sm:grid-cols-2 gap-x-5">
        <Field label="Birth date" htmlFor="dob"><input id="dob" type="date" required max={new Date().toLocaleDateString("en-CA")} value={profile.date_of_birth} onChange={e=>update({date_of_birth:e.target.value})} disabled={busy || !loaded}/></Field>
        <Field label="Local birth time" htmlFor="tob"><input id="tob" type="time" required={profile.birth_time_quality !== "unknown"} disabled={busy || !loaded || profile.birth_time_quality === "unknown"} value={profile.time_of_birth || ""} onChange={e=>update({time_of_birth:e.target.value})}/></Field>
      </div>
      <Field label="How certain is your birth time?" htmlFor="quality"><Select id="quality" value={profile.birth_time_quality} disabled={busy || !loaded} onChange={v=>update({birth_time_quality:v as Profile["birth_time_quality"]})} options={[{value:"exact",label:"I know the exact time"},{value:"approximate",label:"It’s approximate"},{value:"unknown",label:"I don’t know my birth time"}]}/></Field>
      {profile.birth_time_quality === "unknown" && <p className="text-xs muted mb-5">That’s okay. Your chart will omit houses and ascendant, which depend on the birth time.</p>}
      <Field label="Birth city, state and country" htmlFor="place"><input id="place" required maxLength={200} value={profile.birthplace} placeholder="e.g. Jaipur, Rajasthan, India" disabled={busy || searching || !loaded} onChange={e=>{update({birthplace:e.target.value,location:undefined});setPlaces([]);}}/>
        <button type="button" onClick={search} disabled={busy || searching || !loaded || profile.birthplace.trim().length < 2} className="btn btn--ghost justify-self-start">{searching ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>} {searching ? "Finding your city…" : "Find birthplace"}</button>
      </Field>
      {places.length > 0 && <div className="grid gap-2 mb-5" aria-label="Matching birthplaces">{places.map(p=><button type="button" key={`${p.latitude},${p.longitude}`} className="glass-card p-3 text-sm text-left flex gap-2" onClick={()=>{update({location:p});setPlaces([]);setError("");}}><MapPin size={18} className="shrink-0 text-accent"/>{p.display_name}</button>)}</div>}
      {profile.location && <div className="glass-card p-4 mb-5 animate-fade-in"><p className="flex gap-2 text-sm"><CheckCircle2 size={18} className="shrink-0 text-accent"/>{profile.location.display_name}</p><p className="muted text-xs mt-2">Timezone: {profile.location.timezone}</p></div>}
      <p className="text-xs muted mb-5">Place data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>.</p>
      {error && <p role="alert" className="error mb-4">{error}</p>}
      <Button type="submit" disabled={busy || searching || !loaded}>{busy ? <><Loader2 size={16} className="animate-spin"/> Mapping your sky…</> : "Create my chart"}</Button>
      <p className="mt-5 text-xs muted leading-relaxed">Your birthplace is looked up to calculate the chart. Your profile and conversations are saved on this server for this browser. Relevant chart context goes to the AI provider when you ask for a reading.</p>
    </form></Card>
  </section>;
}
