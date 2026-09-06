import type { ChatInput } from "./prompts.js";
import type { WorkspaceStore } from "./workspace.js";

/** Single local worker. Accepted jobs and replies survive browser disconnects. */
export class JobWorker {
  private running = false;
  private stopped = false;
  private task: Promise<void> | undefined;
  constructor(
    private store: WorkspaceStore,
    private respond: (input: ChatInput, owner: string) => Promise<string>,
  ) {}
  wake() {
    if (this.running || this.stopped) return;
    this.running = true;
    this.task = this.drain().finally(() => {
      this.running = false;
    });
  }
  private async drain() {
    while (!this.stopped) {
      const job = this.store.claim();
      if (!job) return;
      try {
        const text = await this.respond(job.input, job.owner);
        if (!text.trim()) throw new Error("Empty response");
        this.store.complete(job, text.slice(0, 32_000));
      } catch {
        this.store.fail(
          job,
          "Your agent could not finish this response. Please try again.",
        );
      }
    }
  }
  async stop() {
    this.stopped = true;
    await this.task;
  }
}
