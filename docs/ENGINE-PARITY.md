# Original-engine parity baseline

R1 implementation evidence, not release approval or a scientific validation of astrology.

The reference is Om's [astropersonalised upstream commit 8485494](https://github.com/Om2524/astropersonalised/tree/8485494f5cbfdd40b5dca578bfc2498974d7e118/shastra-compute). `git ls-remote upstream refs/heads/main` returned that exact commit on 2026-09-06. A moving upstream branch never silently updates this baseline.

## Run

From `shastra-compute`, after `uv sync --frozen --python 3.12`:

```sh
uv run --frozen python -m unittest discover -s tests -p 'parity*.py' -v
```

These seven tests are explicitly selected by `parity*.py`; default `test*.py` discovery does not include them. CI must run this command as well as adapter/product tests. No model, network, geocoder, credentials or real birth data is used when running tests.

## What the fixture proves

`shastra-compute/tests/fixtures/upstream-8485494.json` contains full chart and Vedic, KP, Western and Compare outputs for three synthetic inputs:

| Fixture | Time quality | Domain |
| --- | --- | --- |
| Delhi, 2000-01-01 12:00 Asia/Kolkata | Exact | Career |
| Delhi, 2000-01-01, no time | Unknown | General |
| New York, 1995-07-15 08:30 America/New_York | Approximate | Relationships |

The suite checks:

- Source SHA-256 for every pinned file in `src/core`, `src/engines`, `packages/astro-core` and its symlink; extra/missing source files fail.
- Full chart snapshots plus 12 full reading-evidence outputs, including cross-method agreements and disagreements.
- Compare's three nested outputs equal their independently called engine outputs.
- The same instant expressed as Delhi 12:00 and UTC 06:30 gives equivalent charts and all four evidence outputs, including normalized UTC dasha dates.
- Unknown time uses local noon even when a time is supplied; unreliable-house metadata and every engine's uncertainty flags survive.
- Invalid calendar date, time, IANA zone and quality are rejected with the same exception classes as upstream.
- Dependency versions match the explicit baseline environment.

Fixtures are generated from a temporary `git archive` of the pinned upstream object, **not from the local implementation under test**. Normal tests only read the committed JSON. Every float is rounded to eight decimal places; timezone-aware timestamps are represented in UTC. Everything else, including strings, list order and confidence heuristics, is compared exactly.

## Reproducibility and inherited limitations

The worker sets `PYTHONHASHSEED=0` and fixes the calculator clock to `2026-09-06T12:00:00`. This is necessary because upstream Vedic rules iterate Python sets, while KP uses the **computation weekday**, not the birth weekday, for its day-lord. These behaviors have not been corrected or concealed by changing the preserved engine. Production traceability must retain the actual chart `computed_at` and engine provenance; baseline reproducibility does not prove that production answers are invariant across dates or hash seeds.

The fixture uses Python 3.12, pyswisseph 2.10.3.2 / Swiss Ephemeris 2.10.03, pytz 2026.3.post1 and Pydantic 2.13.5. External ephemeris files are disabled for the fixture to exercise the library's fallback consistently. Different ephemeris data or dependency revisions require explicit baseline review, not automatic snapshot acceptance.

This is a bounded regression baseline, not exhaustive astronomical correctness testing. It does not cover all domains, boundary degrees, polar houses, DST ambiguity/nonexistent local times, remote geocoding, current transits, malformed-coordinate handling, private API isolation, model grounding, or the reading UI. The original calculator's dasha object describes periods at birth, not today's active dasha. Engine confidence numbers are rule heuristics, not calibrated probabilities. R2/R3 and end-to-end release checks remain separate evidence.

## Explicit baseline maintenance

Only update after reviewing the intended upstream change and dependency versions. Change the pinned commit in the harness as part of that reviewed change; then fetch the reference and run:

```sh
git fetch upstream
python tests/parity_baseline.py --record-upstream
python -m unittest discover -s tests -p 'parity*.py' -v
```

The recording command is deliberately separate from tests. Review the full JSON diff and source hashes, record the reason and exact version in the Iktara Buzz thread, and require review before accepting it. A passing baseline alone does not authorize deployment or mark Om's draft task accepted.
