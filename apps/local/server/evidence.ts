import type { ChatInput } from "./prompts.js";

export const METHODS = ["vedic", "kp", "western", "compare"] as const;
export const DOMAINS = [
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
] as const;
export type Method = (typeof METHODS)[number];
export type Domain = (typeof DOMAINS)[number];
export type EvidenceBundle = {
  id: string;
  schema_version: "iktara-evidence-v1";
  method: Method;
  domain: Domain;
  engine_revision: string;
  chart_digest: string;
  birth_time_quality: string;
  items: Array<{ id: string; system: string; kind: string; detail: unknown }>;
  limitations: string[];
  calculation_inputs?: Record<string, unknown>;
  [key: string]: unknown;
};
export class ReadingError extends Error {}

/** Fixed, local-only service. No URL, credentials, chart or owner comes from a model. */
export async function prepareEvidence(
  input: ChatInput,
  endpoint: URL,
  apiKey: string,
  request: (
    url: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response> = fetch,
): Promise<void> {
  if (input.page !== "chart") return;
  if (!input.chart)
    throw new ReadingError(
      "Calculate your birth chart first, then ask your question.",
    );
  if (
    endpoint.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)
  )
    throw new Error("Evidence service must be local HTTP");
  try {
    const response = await request(new URL("/v1/evidence/extract", endpoint), {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({
        chart: input.chart,
        query: input.message,
        method: input.method ?? "compare",
        domain: input.domain ?? "general",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error("Evidence unavailable");
    const value = (await response.json()) as EvidenceBundle;
    if (
      value.schema_version !== "iktara-evidence-v1" ||
      value.method !== (input.method ?? "compare") ||
      value.domain !== (input.domain ?? "general") ||
      !Array.isArray(value.items) ||
      !value.items.length ||
      !Array.isArray(value.limitations) ||
      typeof value.chart_digest !== "string" ||
      typeof value.engine_revision !== "string" ||
      !value.items.every((item) => /^E-[a-f0-9]{16}$/.test(item.id))
    )
      throw new Error("Invalid evidence response");
    input.evidence = { ...value, calculation_inputs: input.calculationInputs };
  } catch {
    throw new ReadingError(
      "Your calculation evidence is unavailable. No reading was generated. Please try again.",
    );
  }
}

/** Referential check, not a semantic truth/entailment checker. Never publish invented IDs. */
export function checkEvidenceReferences(
  text: string,
  evidence: EvidenceBundle,
): void {
  const references = [...text.matchAll(/\[(E-[^\]\s]+)\]/g)].map(
    (match) => match[1],
  );
  const known = new Set(evidence.items.map((item) => item.id));
  if (!references.length || references.some((id) => !known.has(id)))
    throw new ReadingError(
      "The reading could not be linked reliably to its evidence. Please retry your question.",
    );
}

/** Compact model view: no duplicated raw engine/chart payload, short turn-local citations.
 * The complete immutable bundle and hash IDs stay in owned storage.
 */
export function modelEvidence(evidence: EvidenceBundle) {
  return {
    method: evidence.method,
    domain: evidence.domain,
    birth_time_quality: evidence.birth_time_quality,
    limitations: evidence.limitations,
    items: evidence.items.map((item, index) => ({
      citation: `[S${index + 1}]`,
      system: item.system,
      kind: item.kind,
      detail: item.detail,
    })),
  };
}

/** Resolve only aliases from this exact job; invented or malformed aliases fail closed. */
export function resolveEvidenceReferences(
  text: string,
  evidence: EvidenceBundle,
): string {
  const resolved = text.replace(
    /\[S([1-9]\d*)\]/g,
    (reference, number: string) => {
      const item = evidence.items[Number(number) - 1];
      if (!item)
        throw new ReadingError(
          "The reading could not be linked reliably to its evidence. Please retry your question.",
        );
      return `[${item.id}]`;
    },
  );
  if (/\[S[^\]]*\]/.test(resolved))
    throw new ReadingError(
      "The reading could not be linked reliably to its evidence. Please retry your question.",
    );
  checkEvidenceReferences(resolved, evidence);
  return resolved;
}
