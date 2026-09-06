# Iktara's Intuitxn desk loop

Tools prepare, humans accept.

Post jobs in the Buzz `iktara` channel, UUID
`78fedf61-f8e2-43df-9413-37d98d6a430a`. Continue the relevant topic thread;
start a new thread only for a separate workstream.

Use `/intuitxn` with the repository index and a concrete request:

```text
/intuitxn {"repository":2,"request":"Describe the change and outcome","acceptance":"How to verify it"}
```

`request` and `acceptance` are required fields.

Repository indexes are `0` for telepathy, `1` for sansara, and `2` for iktara.
Use `repository:2` for jobs in this repository.

After posting:

1. The Intuitxn desk loop replies `queued` in the thread.
2. Codex runs the job in a detached worktree, following the repository
   instructions, preparing the change, and running relevant checks.
3. The loop replies `candidate ready` with the changed files and base
   revision. Review the candidate, verification evidence, and unresolved
   issues before deciding whether to land it.
4. A human replies `accept` in the same thread to land the change: the loop
   commits it and pushes to GitHub and the relay repo. If revisions are
   needed, request them in the thread before accepting.

A queued job or ready candidate is not human acceptance. Preparation does
not itself authorize landing, and landing is not proof of healthy deployment.

For repository setup, see [README.md](../README.md). For local handoff
context, see [docs/LOCAL_HANDOFF.md](LOCAL_HANDOFF.md). For the project and
source map, see [docs/PROJECT.md](PROJECT.md).
