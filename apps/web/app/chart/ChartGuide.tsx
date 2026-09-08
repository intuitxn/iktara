"use client";
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { runtimeApi, isActiveJob, type Job, type Message, type ReadingMethod } from "@/app/lib/runtimeApi";
import ReadingAnswer from "@/app/chat/components/ReadingAnswer";
const QUESTION = "Introduce me to my birth chart in plain language. Explain two or three important patterns and one useful reflection, with the limits of my birth time.";

export default function ChartGuide({method,chart}: {method:ReadingMethod;chart:Record<string,unknown>}) {
  const [job,setJob] = useState<Job|null>(null);
  const [answer,setAnswer] = useState<Message|null>(null);
  const [error,setError] = useState("");
  const [submitting,setSubmitting] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const busy = submitting || Boolean(job && isActiveJob(job));
  useEffect(()=>{
    let cancelled=false;
    runtimeApi.workspace().then(data=>{
      if(cancelled)return;
      const question=data.messages.find(m=>m.role === "user" && m.content === QUESTION && m.method === method && m.createdAt >= Date.parse(String(chart.computed_at || "").replace(/Z?$/, "Z")));
      if(question){
        setAnswer(data.messages.find(m=>m.role === "assistant" && m.jobId === question.jobId) || null);
        setJob(data.jobs.find(j=>j.id === question.jobId) || null);
      }
    }).catch(()=>{if(!cancelled)setError("Could not load your saved explanation. Reload to try again.");}).finally(()=>{if(!cancelled)setLoaded(true);});
    return ()=>{cancelled=true;};
  },[method,chart]);
  const active = job && isActiveJob(job) ? job.id : null;
  useEffect(()=>{
    if(!active)return;
    let cancelled=false;let timer:ReturnType<typeof setTimeout>;
    async function poll(){
      try{
        const current=await runtimeApi.job(active!);if(cancelled)return;
        if(isActiveJob(current)){setJob(current);timer=setTimeout(poll,1200);return;}
        const data=await runtimeApi.workspace();if(cancelled)return;
        setAnswer(data.messages.find(m=>m.role === "assistant" && m.jobId === active) || null);setJob(current);
        setError(current.status === "error" ? current.error || "The explanation was interrupted. Please retry." : "");
      }catch{if(!cancelled){setError("Reconnecting to your saved explanation…");timer=setTimeout(poll,3000);}}
    }
    void poll();return()=>{cancelled=true;clearTimeout(timer);};
  },[active]);
  async function explain(){
    if(busy)return;setSubmitting(true);setError("");
    try{
      const result=await runtimeApi.chat({page:"chart",method,domain:"general",message:QUESTION,requestId:crypto.randomUUID()});
      setJob({id:result.jobId,page:"chart",status:"pending",method});
    }catch(e){setError(e instanceof Error ? e.message : "Could not start your explanation.");}
    finally{setSubmitting(false);}
  }
  return <section className="glass-section p-5 animate-fade-in" aria-label="Your chart explained">
    <div className="flex items-center gap-2 mb-3"><Sparkles size={20} className="text-accent"/><h2 className="font-semibold">Your chart, in your words</h2></div>
    {answer ? <ReadingAnswer message={answer}/> : <p className="text-sm text-text-secondary mb-4">Explore what these placements can mean for you. Iktara uses your calculated chart to explain the patterns, with sources you can open.</p>}
    {busy && <p role="status" className="flex items-center gap-2 my-4 text-sm text-text-secondary"><Loader2 size={17} className="animate-spin"/>{job?.status === "running" ? "Connecting your chart patterns…" : "Preparing your explanation…"}</p>}
    {error && <p role="alert" className="error my-3 text-sm">{error}</p>}
    {!answer && <button className="btn btn--primary" disabled={!loaded || busy} onClick={explain}>Explain my {method === "vedic" ? "Vedic" : "Western"} chart</button>}
  </section>;
}
