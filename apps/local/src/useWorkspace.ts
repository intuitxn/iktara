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
  const [draft, setDraft] = useState("");
  const [activity, setActivity] = useState<"chart" | "chat" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState("Connecting");
  const [editing, setEditing] = useState(true);
  const [ready, setReady] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const generation = useRef(0);
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
      setChart(data.chart);
      setEditing(!data.chart);
    }
  }
  async function refresh(hydrateProfile = false) {
    const turn = generation.current;
    const data = await api<Workspace>("/api/workspace");
    if (turn === generation.current) applyWorkspace(data, hydrateProfile);
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    api<Workspace>("/api/workspace")
      .then((data) => {
        if (cancelled) return;
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
        setJobs((current) =>
          current.map(
            (job) => updates.find((item) => item.id === job.id) || job,
          ),
        );
        if (updates.some((job) => !isActive(job))) {
          await refresh();
          if (!cancelled) setNotice("");
        }
      } catch (failure) {
        if (!cancelled)
          setNotice(
            "Your agent is working in the background. Reopen this space if the connection is interrupted.",
          );
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
  async function send(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy || !ready) return;
    const turn = generation.current;
    setActivity("chat");
    setError("");
    setNotice("");
    try {
      await api("/api/profile", "PUT", { profile });
      const result = await api<{ jobId: string }>("/api/chat", "POST", {
        message,
        page,
        requestId: crypto.randomUUID(),
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
  };
}
