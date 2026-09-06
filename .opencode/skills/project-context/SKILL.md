---
name: Iktara Project Context
description: The project.json source map, Buzz project wiring, host controls, and handoff conventions. Use for source maps, handoffs, and Buzz references.
---

# Iktara Project Context

`project.json` is the versioned source map: Buzz project address, product/upstream/team repositories, builder agent definition, engine paths, context files, and workflow commands.

## Commands

- `npm run project:context` — sanitized JSON source map with checkout revision, dirty flag, and SHA-256 fingerprints of every context file.
- `npm run project:check` — validates that every referenced file and engine system exists.
- `npm run host:status` / `npm run host:update` — host-side controls; run only on the hosting Mac, never from an ordinary contributor session.

## Buzz wiring

The project is already registered in Buzz (`project.json` → `buzz.project`, `projectAddress`, channel `iktara`). Buzz holds requests, decisions, and reviewed handoffs; git holds executable context and prompts. A markdown agent definition does not activate a Buzz identity, and no key material belongs in this repository.

## Handoffs

Include the source map and exact revision when handing work to Telepathy or another agent. Use `docs/templates/session-handoff.md` and sanitize private data.
