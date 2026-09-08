// Typed client for the same-origin Iktara runtime, which proxies pages to Next.js.
// The runtime sets the iktara_session cookie, so fetches use
// credentials: "include" to keep the workspace scoped.
export type BirthLocation = { latitude: number; longitude: number; timezone: string; display_name: string };
export type Profile = {
  username?: string;
  location?: BirthLocation;
  name: string;
  date_of_birth: string;
  time_of_birth: string | null;
  birthplace: string;
  birth_time_quality: "exact" | "approximate" | "unknown";
};
export type ReadingMethod = "vedic" | "kp" | "western" | "compare";
export type ReadingDomain =
  | "general"
  | "career"
  | "relationships"
  | "marriage"
  | "family"
  | "money"
  | "health"
  | "purpose"
  | "personality"
  | "education"
  | "spirituality"
  | "timing"
  | "compatibility";
export type EvidenceItem = {
  id: string;
  system: string;
  kind: string;
  detail: unknown;
};
export type ReadingEvidence = {
  chart_snapshot?: Record<string, unknown>;
  id: string;
  method: string;
  domain: string;
  engine_revision: string;
  chart_digest: string;
  items: EvidenceItem[];
  limitations: string[];
  birth_time_quality: string;
};
export type Message = {
  id: string;
  page: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  jobId?: string;
  evidence?: ReadingEvidence;
  method?: ReadingMethod;
  domain?: ReadingDomain;
};
export type Job = {
  id: string;
  page: string;
  status: "pending" | "running" | "completed" | "error";
  text?: string;
  error?: string;
  evidence?: ReadingEvidence;
  method?: ReadingMethod;
  domain?: ReadingDomain;
};
export type ChartResult = {
  profile?: Profile;
  chart: Record<string, unknown>;
  display_name: string;
  timezone: string;
};
export type World = { id: string; label: string; description: string };
export type Workspace = {
  profile: Profile | null;
  chart: ChartResult | null;
  messages: Message[];
  worlds: World[];
  jobs: Job[];
};
export const METHODS: ReadingMethod[] = ["vedic", "kp", "western", "compare"];
export const DOMAINS: ReadingDomain[] = [
  "general",
  "career",
  "relationships",
  "marriage",
  "family",
  "money",
  "health",
  "purpose",
  "personality",
  "education",
  "spirituality",
  "timing",
  "compatibility",
];
export const EMPTY_PROFILE: Profile = {
  name: "",
  date_of_birth: "",
  time_of_birth: null,
  birthplace: "",
  birth_time_quality: "exact",
};
export type ChatInput = {
  message: string;
  page: string;
  requestId?: string;
  method?: ReadingMethod;
  domain?: ReadingDomain;
};
async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "include",
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "The connection was interrupted. Please try again.",
    );
  }
  return result as T;
}
export const runtimeApi = {
  places: (query: string) => api<{places: BirthLocation[]}>(`/api/places?q=${encodeURIComponent(query)}`),
  workspace: () => api<Workspace>("/api/workspace"),
  saveProfile: (profile: Profile) =>
    api<Workspace>("/api/profile", "PUT", { profile }),
  computeChart: (profile: Profile) =>
    api<ChartResult>("/api/chart", "POST", { profile }),
  chat: (input: ChatInput) =>
    api<{ jobId: string }>("/api/chat", "POST", input),
  job: (id: string) => api<Job>(`/api/jobs/${id}`),
  reset: () => api<{ ok: boolean }>("/api/workspace", "DELETE"),
};
export function normalizeProfile(profile: Profile): Profile {
  return {
    name: profile.name.trim(),
    date_of_birth: profile.date_of_birth,
    time_of_birth:
      profile.birth_time_quality === "unknown"
        ? null
        : profile.time_of_birth || null,
    birthplace: profile.birthplace.trim(),
    birth_time_quality: profile.birth_time_quality,
  };
}
export function isActiveJob(job: Job): boolean {
  return job.status === "pending" || job.status === "running";
}
