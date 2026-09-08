import type { ChatInput } from "./prompts.js";
import type { WorkspaceStore } from "./workspace.js";
import { resolveEvidenceReferences, ReadingError } from "./evidence.js";

/** Bounded workers. Accepted jobs and replies survive browser disconnects. */
export class JobWorker {
  private stopped = false;
  private tasks = new Set<Promise<void>>();
  constructor(
    private store: WorkspaceStore,
    private respond: (
      input: ChatInput,
      owner: string,
      jobId: string,
    ) => Promise<string>,
    private prepare: (input: ChatInput) => Promise<void> = async () => {},
  ) {}
  wake() {
    if (this.stopped) return;
    while (this.tasks.size < 2) {
      const task = this.drain().finally(() => this.tasks.delete(task));
      this.tasks.add(task);
    }
  }

  private async drain() {
    while (!this.stopped) {
      const job = this.store.claim();
      if (!job) return;
      try {
        await this.prepare(job.input);
        let text = await this.respond(job.input, job.owner, job.id);
        if (!text.trim()) throw new Error("Empty response");
        if (job.input.page === "chart" && !job.input.evidence)
          throw new ReadingError(
            "The reading did not return calculation evidence. Please retry your question.",
          );
        if (job.input.evidence)
          text = resolveEvidenceReferences(text, job.input.evidence);
        this.store.complete(job, text.slice(0, 32_000));
      } catch (error) {
        this.store.fail(
          job,
          error instanceof ReadingError
            ? error.message
            : "Your agent could not finish this response. Please try again.",
        );
      }
    }
  }
  async stop() {
    this.stopped = true;
    await Promise.all(this.tasks);
  }
}
