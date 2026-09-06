---
name: Astro Engine (astropersonalised)
description: Work with the preserved prior astro engine from the astropersonalised repository — Vedic, KP, Western, and Compare calculations and evidence extraction. Use before any engine change, upgrade, or parity question.
---

# Astro Engine (astropersonalised)

The engine in this repository is the prior version from Om's astropersonalised repository (git remote `upstream`). Parity is a rule, not a preference: engine sources must stay identical to upstream/main unless a reviewed decision says otherwise.

## Locations

| Piece | Path |
| --- | --- |
| Reference package | `packages/astro-core/` (`packages/astro_core` is a symlink to it) |
| Runtime copies | `shastra-compute/src/core/`, `shastra-compute/src/engines/` |
| Systems | `vedic.py`, `kp.py`, `western.py`, `compare.py` (+ shared `base.py`) |
| Chart model | `shastra-compute/src/core/models/chart.py` |
| Local service | `shastra-compute/src/local_app.py` (chart router only) |

## Parity check

```sh
git fetch upstream
git diff upstream/main -- shastra-compute/src/engines shastra-compute/src/core packages/astro-core packages/astro_core
```

No output means parity with the prior astropersonalised engine at the current upstream/main revision. A diff in `src/local_app.py` is expected (local mounting file). Any other diff is a violation; restore or get a reviewed decision first.

## Active vs preserved

- Active: deterministic chart calculation (`ChartCalculator`, Swiss Ephemeris) through `src/core/calculator.py` and the chart router.
- Preserved, not mounted: the Vedic/KP/Western/Compare reading-evidence pipeline under `src/engines/`. `local_app.py` does not mount the reading router.

Never describe the live product as having reading-engine parity until that integration is completed and reviewed.

## Working with the engine

1. Read `shastra-compute/src/core/calculator.py` and the relevant engine files before changing anything.
2. Calculation changes come from upstream: port from `upstream/main` with attribution, and review them separately from local mounting changes.
3. Run the stack with `npm run dev` (chart service on 8020), or `cd shastra-compute && uv sync --frozen --python 3.12` for the Python service alone.
4. Verify only with synthetic birth profiles. Never use private customer data.
