import { useEffect, useRef, useState, type FormEvent } from "react";

export type Profile = {
  name: string;
  date_of_birth: string;
  time_of_birth: string | null;
  birthplace: string;
  birth_time_quality: string;
};
export type Message = {
  id: string;
  page: "reflection" | "chart";
  role: "user" | "assistant";
  content: string;
  jobId?: string;
  method?: ReadingMethod;
  domain?: ReadingDomain;
  evidence?: ReadingEvidence;
};
export type ReadingMethod = "vedic" | "kp" | "western" | "compare";
export type ReadingDomain = "general" | "career" | "relationships" | "marriage" | "family" | "money" | "health" | "purpose" | "personality" | "education" | "spirituality" | "timing" | "compatibility";
export type ReadingEvidence = {
  id: string;
  method: string;
  domain: string;
  engine_revision: string;
  chart_digest: string;
  items: Array<{ id: string; system: string; kind: string; detail: unknown }>;
  limitations: string[];
  birth_time_quality: string;
};
export type Planet = { name: string; sign: string; sign_degree: number };
export type Chart = {
  tropical_planets?: Planet[];
  sidereal_planets?: Planet[];
  ascendant_tropical?: number;
  birth_time_quality?: string;
  [key: string]: unknown;
};
export type ChartResult = {
  chart: Chart;
  display_name: string;
  timezone: string;
};
type Page = "reflection" | "chart";
type Job = {
  id: string;
  page: Page;
  status: "pending" | "running" | "completed" | "error";
  text?: string;
  error?: string;
  createdAt: number;
  method?: ReadingMethod;
  domain?: ReadingDomain;
};
type Workspace = {
  profile: Profile | null;
  chart: ChartResult | null;
  messages: Message[];
  jobs: Job[];
};
const emptyProfile: Profile = {
  name: "",
  date_of_birth: "",
  time_of_birth: "",
  birthplace: "",
  birth_time_quality: "exact",
};
const legacyKey = "iktara.local.v1";
const isActive = (job: Job) =>
  job.status === "pending" || job.status === "running";
const normalizedProfile = (profile: Profile): Profile => ({
  name: profile.name.trim(),
  date_of_birth: profile.date_of_birth,
  time_of_birth: profile.birth_time_quality === "unknown" ? null : profile.time_of_birth || null,
  birthplace: profile.birthplace.trim(),
  birth_time_quality: profile.birth_time_quality,
});

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "The connection was interrupted. Please try again.",
    );
  return result as T;
}

export function useWorkspace() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState<Page>("reflection");
  const [method, setMethod] = useState<ReadingMethod>("compare");
  const [domain, setDomain] = useState<ReadingDomain | "">("");
  const [draft, setDraft] = useState("");
  const [activity, setActivity] = useState<"chart" | "chat" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState("Connecting");
  const [editing, setEditing] = useState(true);
  const [ready, setReady] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const generation = useRef(0);
  const savedProfile = useRef<Profile | null>(null);
  const activeJob = jobs.find((job) => job.page === page && isActive(job));
  const busy = activity || (activeJob ? "chat" : null);
  const history = messages.filter((message) => message.page === page);
  const lastJob = jobs.find((job) => job.page === page);
  const jobError =
    lastJob?.status === "error"
      ? lastJob.error || "This response was interrupted. Please try again."
      : "";

  function applyWorkspace(data: Workspace, hydrateProfile = false) {
    setMessages(data.messages);
    setJobs(data.jobs);
    if (hydrateProfile) {
      setProfile(data.profile || { ...emptyProfile });
      savedProfile.current = data.profile ? normalizedProfile(data.profile) : null;
      setChart(data.chart);
      setEditing(!data.chart);
      const latestReading = data.jobs.find((job) => job.page === "chart");
      setMethod(latestReading?.method || "compare");
      setDomain(latestReading?.domain || "");
    }
  }
  async function refresh(hydrateProfile = false) {
    const turn = generation.current;
    const data = await api<Workspace>("/api/workspace");
    if (turn === generation.current) applyWorkspace(data, hydrateProfile);
    return data;
  }
  async function reconnect() {
    setHealth("Reconnecting…");
    try {
      await refresh(!ready);
      setReady(true);
      setError("");
      setNotice("");
      setHealth("Your private space");
    } catch {
      setHealth("Connection unavailable");
      setError("Could not reconnect. Your saved questions remain on the server. Try again when the connection returns.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    api<Workspace>("/api/workspace")
      .then((data) => {
        if (cancelled) return;
        setHealth("Your private space");
        applyWorkspace(data, true);
        setReady(true);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    api<{ ok: boolean }>("/api/health")
      .then((data) => {
        if (!cancelled)
          setHealth(data.ok ? "Your private space" : "Service needs attention");
      })
      .catch(() => {
        if (!cancelled) setHealth("Connection unavailable");
      });
    try {
      setLegacy(Boolean(localStorage.getItem(legacyKey)));
    } catch {}
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll only owned job endpoints. The browser can close while the server works.
  const pendingIDs = jobs
    .filter(isActive)
    .map((job) => job.id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!pendingIDs) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const updates = await Promise.all(
          pendingIDs.split(",").map((id) => api<Job>(`/api/jobs/${id}`)),
        );
        if (cancelled) return;
        setHealth("Your private space");
        if (updates.some((job) => !isActive(job))) {
          // Keep polling until the saved response is fetched too. Marking the
          // job complete first would stop recovery if this refresh disconnects.
          await refresh();
          if (!cancelled) setNotice("");
        } else {
          setJobs((current) =>
            current.map((job) => updates.find((item) => item.id === job.id) || job),
          );
          setNotice("");
        }
      } catch (failure) {
        if (!cancelled) {
          setHealth("Reconnecting…");
          setNotice(
            "Connection interrupted. Reconnecting to your saved question; you do not need to send it again.",
          );
        }
      }
      if (!cancelled) timer = setTimeout(poll, 1000);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pendingIDs]);

  function update(key: keyof Profile, value: string) {
    setProfile((previous) => ({ ...previous, [key]: value }));
    setChart(null);
  }
  async function compute(event: FormEvent) {
    event.preventDefault();
    if (!ready || activity) return;
    setActivity("chart");
    setError("");
    setNotice("");
    const turn = generation.current;
    try {
      const result = await api<ChartResult>("/api/chart", "POST", {
        ...profile,
        time_of_birth:
          profile.birth_time_quality === "unknown"
            ? null
            : profile.time_of_birth || null,
      });
      if (turn !== generation.current) return;
      setChart(result);
      savedProfile.current = normalizedProfile(profile);
      setEditing(false);
      setPage("chart");
      setNotice(
        "Your chart is saved in this space. Ask your chart companion what you would like to explore.",
      );
    } catch (failure) {
      if (turn === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Your chart could not be calculated.",
        );
    } finally {
      if (turn === generation.current) setActivity(null);
    }
  }
  async function submit(message: string, readingMethod = method, readingDomain = domain) {
    if (!message || busy || !ready) return;
    if (page === "chart" && !chart) {
      setError("Calculate your chart before asking for a reading.");
      setEditing(true);
      return;
    }
    const turn = generation.current;
    setActivity("chat");
    setError("");
    setNotice("");
    try {
      // Saving birth details invalidates the server chart. Do not save an
      // unchanged profile between chart calculation and a reading request.
      const next = normalizedProfile(profile);
      if (JSON.stringify(next) !== JSON.stringify(savedProfile.current)) {
        await api("/api/profile", "PUT", { profile: next });
        savedProfile.current = next;
      }
      const result = await api<{ jobId: string }>("/api/chat", "POST", {
        message,
        page,
        requestId: crypto.randomUUID(),
        ...(page === "chart" ? { method: readingMethod, ...(readingDomain ? { domain: readingDomain } : {}) } : {}),
      });
      if (turn !== generation.current) return;
      setDraft("");
      await refresh();
      setNotice(
        "Your companion is working. You can switch spaces or return later.",
      );
      if (!result.jobId) throw new Error("The response could not be started.");
    } catch (failure) {
      if (turn === generation.current) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Your response could not be started.",
        );
        await refresh().catch(() => {});
      }
    } finally {
      if (turn === generation.current) setActivity(null);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    await submit(draft.trim());
  }
  const failedMessage = lastJob?.status === "error"
    ? history.find((message) => message.role === "user" && message.jobId === lastJob.id)
    : undefined;
  async function retry() {
    if (!failedMessage) return;
    const retryMethod = failedMessage.method || method;
    const retryDomain = failedMessage.domain || domain;
    setMethod(retryMethod);
    setDomain(retryDomain);
    await submit(failedMessage.content, retryMethod, retryDomain);
  }
  async function clear() {
    if (
      !window.confirm(
        "Delete the birth details, chart, conversations, and agent responses in this workspace?",
      )
    )
      return;
    try {
      await api("/api/workspace", "DELETE");
      generation.current++;
      setProfile({ ...emptyProfile });
      savedProfile.current = null;
      setChart(null);
      setMessages([]);
      setJobs([]);
      setDraft("");
      setActivity(null);
      setError("");
      setEditing(true);
      setNotice("This workspace has been cleared.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your data could not be cleared.",
      );
    }
  }
  async function importLegacy() {
    if (
      !window.confirm(
        "Copy the earlier birth details saved in this browser into this workspace? This will replace the current birth details. The old chat history will not be imported.",
      )
    )
      return;
    try {
      const old = JSON.parse(localStorage.getItem(legacyKey) || "null");
      if (!old?.profile)
        throw new Error("No earlier birth details were found.");
      const next: Profile = {
        name: old.profile.name || "",
        date_of_birth: old.profile.date_of_birth || "",
        time_of_birth: old.profile.time_of_birth || null,
        birthplace: old.profile.birthplace || "",
        birth_time_quality: old.profile.birth_time_quality || "unknown",
      };
      await api("/api/profile", "PUT", { profile: next });
      await refresh(true);
      setLegacy(false);
      setNotice(
        "Birth details imported. Calculate a fresh chart when you are ready. Earlier browser data has been left intact.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The earlier details could not be imported.",
      );
    }
  }
  return {
    profile,
    chart,
    history,
    draft,
    setDraft,
    busy,
    error: error || jobError,
    notice,
    health,
    editing,
    setEditing,
    update,
    compute,
    send,
    clear,
    page,
    setPage,
    ready,
    activeJob,
    legacy,
    importLegacy,
    method,
    setMethod,
    domain,
    setDomain,
    reconnect,
    failedMessage,
    retry,
  };
}
