# Automatic average stats — November 12, 2026

The default result is now a complete nine-stat average at the chosen level. Players choose a character, class and target level; starting values load automatically. Manual checkpoint entry is an optional, explicit override below the results.

## Source data

Read the researcher's [level-1 base-stat spreadsheet](https://docs.google.com/spreadsheets/d/12Lrk_M4_cgy6P0_WB9QXknDLDjyKtbeUkhWk32pTGqo/edit?gid=0) through the Google Sheets connector, using metadata-confirmed 'Base Stats'!A1:N55. It contains 54 named characters. The [research post](https://www.reddit.com/r/fireemblem/comments/1xfi42m/fortunes_weave_base_stats_and_almost_exact/) credits u/averysillyman and Aggro Incarnate's collected level-up data. No source spreadsheet was edited.

The [Serenes Forest level-1 table](https://serenesforest.net/fortunes-weave/characters/base-stats/) supplies nine additional characters: Aswan, Centurio, Creek, Eshmel, Hong Hua, Klapka, Nathan, Tahonia and Troy. Its player table explicitly identifies level 1. Three repeated headers and the later NPC/uncertain-playability tables are excluded.

Coverage is **63 unique characters / all 64 existing selectable profiles**, each with nine starting stats. Mu (with growth) reuses Mu's starting values because the separate profile represents altered level-up growth; their selected growth rates and session entries remain independent. The dataset records that mapping explicitly.

The research sheet takes precedence where both sources provide a record. There is **one disagreement**: Bonaventure's Speed is 7 in the primary sheet and 6 in Serenes Forest. The chosen 7 and alternative 6 are both preserved; a visible notice accompanies Bonaventure's calculations. [Yu Pha's Temple](https://yuphastemple.com/bonaventure/) independently lists 7. These are community-sourced baselines, not a claim of official verification.

## Calculation and user flow

```text
effective growth = max(0, existing personal growth + existing class growth)
level-ups = target level − 1
average stat = published level-1 base + level-ups × effective growth / 100
```

Alexandra + Gladiator at level 41: starting Strength **7**, personal growth **35%**, class growth **10%**, forty level-ups. **7 + 40 × 0.45 = 25.0 average Strength**. At level 1 the result is the published starting stat, with zero growth gains. Level 99 is also supported. Fractions remain unrounded internally; display uses one decimal place.

Average Stats is the default display. The Average stats at level selector sits directly beside the result heading and stays synchronized with the original main Target level selector. Expected Growth retains the personal/class breakdown. My Stats vs Expected compares observed values directly against the automatic baseline; no manual checkpoint is required.

Compare my stats / use a custom starting point is below the table. Published level-1 stats remains the default until the player explicitly selects My own checkpoint. Old checkpoint text cannot silently override automatic averages. Returning to Published level-1 stats restores automatic results without erasing the session-only manual entries. Partial custom checkpoints remain partial: missing values never borrow published values or become zero.

The original checkpoint example still works: level 10 Strength 16, target 30, 45% growth gives **9.0 gains / 25.0 projected Strength**. Actual 27 gives +2.0. Equal levels give zero gains and preserve supplied values; backward projections and invalid inputs still show errors.

## Scope and preservation

This is the requested simplified constant-class expectation, using published level-1 bases even for late recruits. It is not recruitment autoleveling or a reconstruction of a character's class history. Sources distinguish autoleveling from player growth, so no recruitment formula is silently introduced. Starting values are used as published; no extra selected-class flat, equipment or mount bonus is added. Certification floors, minimum-total-gain rules, boosters, abilities and caps remain excluded. Zero-personal-growth substitution remains unsupported without separate class base-growth data. Existing class disputes remain visible.

Original workbook, growth records, old importer, persistence schemas, keys, migrations and export formatters are unchanged. The new data is a separate offline reference. Manual entries and starting-point choice are per main character and session-only. No observation is automatically persisted, and Build A/B behavior remains unchanged.

## Reproducible import

Read-only inputs:

- data/base-stats/research-sheet.json — bounded native-sheet values, provenance and review date.
- data/base-stats/serenes-base-stats.html — reviewed published page snapshot.

```powershell
python scripts/import_character_bases.py
python scripts/import_character_bases.py --check
```

The importer validates headers, explicit source level, names, duplicates, nine non-negative integer base stats, roster coverage and source disagreements before writing src/data/character-bases.json. It records source hashes and cell/URL references. It requires no network access. The frontend uses typed JSON and the existing pure growth projection; no server API or dependency is added. The reference JSON has its own production chunk, matching the app's existing static-data architecture.

## Every changed application/documentation file

- src/App.tsx — connect the result-level selector to authoritative main target state.
- src/expectedStats.ts — optional session-only starting-point choice; original formulas unchanged.
- src/ExpectedStatsByLevel.tsx — automatic averages, optional custom starting point and simpler results-first controls.
- src/ExpectedStatsByLevel.test.tsx — retain existing feature regressions, update intentional display changes and add six automatic-flow cases.
- src/characterBases.ts — typed starting-stat lookup and pure automatic/manual baseline resolver.
- src/characterBases.test.ts — ten new provenance/mapping/calculation tests.
- src/data/character-bases.json — generated 64-profile starting-stat reference.
- scripts/import_character_bases.py — reproducible offline import and freshness check.
- tests/test_character_bases.py — twelve source/import/validation regression tests.
- data/base-stats/research-sheet.json — new read-only source snapshot.
- data/base-stats/serenes-base-stats.html — new read-only source snapshot.
- src/styles.css — local target selector and optional manual-entry controls.
- vite.config.ts — separate cacheable chunk for the new reference data.
- AVERAGE_STATS_FIX_REPORT.md — this report.
- INCREMENT_24_REPORT.md — link the latest correction; retain historical verification.
- README.md and INTEGRATION_GAPS.md — current automatic-average behavior and remaining boundaries.

Generated dist/ is rebuilt. Logs and pre-edit snapshots are in work/base-stats-2026-11-12/.

## Verification

- Focused frontend: **73 passed** (41 original calculation, 22 UI, 10 new starting-stat model cases).
- New importer cases: **12 passed**.
- Complete Python: **184 passed**.
- Node artifact checks: **7 passed**.
- Complete frontend: **910 passed in 69 files**, one worker, 30-second test timeout; no skipped or failed cases. Total: **1,101 passing checks** (910 frontend + 184 Python + 7 Node).
- TypeScript: passed.
- Production build: passed; main chunk 474.77 kB, no size warning after separating the new dataset.
- Original protected data/persistence artifacts: all 55 hashes unchanged.
- Local server: confirmed it serves the updated interface and new base-stat JSON.
- Desktop/390px/320px visual verification: pending. Both browser and native computer-use initialization fail before connecting with “failed to write kernel assets: The system cannot find the path specified.” No visual pass or live PC-control demonstration is claimed.

The last complete run passed 890 frontend, 172 Python and seven Node checks. The subsequent presentation fix added four UI cases, verified in its focused run, bringing the pre-update frontend inventory to 894. This update adds ten model, six UI and twelve importer cases. Updated UI assertions preserve the original checkpoint/comparison/save/export scenarios while testing the new default totals.

## Next small increment

After live visual verification, consider optional sourced recruitment checkpoints. Keep them separate from the published level-1 constant-class baseline and show route/recruitment conditions explicitly. No recruitment autolevel simulator or new increment is implemented here.
