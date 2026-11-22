# Ability description research and independent audit

Added 97 reviewed, game-specific web definitions to the existing calculator, restored 60 complete spreadsheet name-cell notes, and expanded compound unlocks into readable child descriptions. Name, exact rank and effect still lead the UI; provenance stays in closed details. Source workbooks, saved identities and calculations remain unchanged.

## Implemented

- New offline `ability-research.json` supplement: 97 cited descriptions, four exact-path historical-name reconciliations covering three names, and one explicitly unresolved older unlock. No server/API dependency or new package.
- All 595 imported definition records have useful display content: 593 have effect descriptions and two retain clearly classified recorded-value summaries. The importer retained all previous535 records and added60 semantic name-cell notes, excluding provisional rank guesses and character-specific notes on other columns.
- All301 additional-sheet and307 original named/category pairs are audited with full source context. The only original named unlock without established mechanics is Ninae’s older Lend Resistance record.
- All53 distinct compound texts now display the component abilities separately. Original rank/base/prologue/level annotations remain attached. Parent source identities and existing shortlist restrictions remain intact.
- 87 of89 formerly blank upgraded-art effects now have directly documented descriptions. Effects are matched to the actual upgraded entry; they are not inherited from a base art.
- Exact character, proficiency, rank and original source cell constrain reconciliations for Lancefaire→Spearfaire (Ninae/Seteth), Brilliant Blow→Brilliant Strike (Orchel) and Superior Bowblock→Bowblock+ (Anatolia). A published page explicitly supports Defense Formation+/Defensive Formation+ as alternative names.
- Lend Magic now retains the supplied **Mag/Res +2/3/5** effect from Authority!A81’s note, rather than the incomplete Magic-only mirror. Original raw descriptions remain available as alternatives.
- The inspector, shortlist, main overview and common Copy/TXT formatter use the same resolver and source scope. Export metadata distinguishes researched descriptions, historical reconciliations, compound descriptions, recorded values and unresolved records.
- Research validation rejects stale source snapshots, duplicate definitions/paths, missing scoped identities, unsafe citation schemes and invented descriptions on unresolved records. The production freshness check blocks research bound to a different snapshot.

## Research sources

Research used game-specific community references, not similarly named skills in other Fire Emblem games. All descriptions retain their individual citations and review date (2026-10-29) in the supplement. Community documentation is not promoted to official publisher confirmation.

- [Anna’s Notebook: Counter Fliers](https://annasnotebook.net/en/skills/counter-fliers/) and [Counter Fliers+](https://www.annasnotebook.net/en/skills/counter-fliers-plus/).
- [Anna’s Notebook: Defense Formation+](https://annasnotebook.net/en/skills/sk-421/), [Spearfaire](https://annasnotebook.net/en/skills/spearfaire/), [Brilliant Strike](https://annasnotebook.net/en/skills/brilliant-strike/), [Bowblock+](https://annasnotebook.net/en/skills/bowblock-plus/) and [Haphazard+](https://annasnotebook.net/en/skills/haphazard/). The last page’s URL is unsuffixed, but its actual heading/body identify the upgraded art.
- [Yu Pha’s Temple: weapons and magic](https://yuphastemple.com/weapons/) supplies the base spell descriptions; the skill references corroborate the two base combat-art descriptions.
- [Fortune’s Weave Encyclopedia: combat arts](https://fire-emblem-fortunes-weave.turam.dev/en/category/combat-art/) and the live Spear/Axe/Bow/Gauntlet tables supply explicit upgraded entries. Search-tool pages returned a Sword fallback for some groups; the live browser’s actual headings and rendered rows were checked before accepting those effects. Individual observed detail links are retained in the supplement.
- [GameWith Japanese combat-art data](https://gamewith.jp/fefw/573032) corroborates the distinction between Resilience and Resistance.

A generic SEO wiki’s conflicting damage-reduction claim was rejected. Partial fields were not defaulted to zero, and no new effectiveness multiplier was invented.

## Three genuine unresolved mechanics

1. **Greater Hexblade+**: the supplied row records Might+15 and Hit+20; a reliable upgraded effect was not found. The UI shows only those recorded values, without assuming magical damage from the base art.
2. **Spirit Blow+**: the supplied row records Might+15 and Hit+20; its upgraded effect was not found. It is not equated with Spirit Fist+ and does not inherit the base row’s “No additional effect” statement.
3. **Lend Resistance**: the old Ninae/Authority S record conflicts with the current supplied record, Lend Strength++. Its readable notice explains the disagreement; no Resistance bonus is assigned and the saved source path is not remapped. The current [Authority H42 cell](https://docs.google.com/spreadsheets/d/1toaw286JE2caHAnf_5zy-_4m-3PM-ysS9ihmd2SBjtE/edit#gid=1411071706&range=H42) is cited directly.

These are unresolved special-effect mechanics, not empty UI placeholders. Reliable in-game evidence is needed to establish them. Existing unrelated growth/mount disputes remain intact.

## Independent audits and fixes

Two other agents audited the work:

- **Description research/factual audit:** verified the Counter Fliers variants, historical-name paths, formulas, trigger conditions, phase durations, follow-up restrictions and attack proportions. It caught the need for source-scoped reconciliations, identified Haphazard+ on its unsuffixed page, found the fuller Lend Magic note, and confirmed the final three unresolved cases. Final inspection found no blocking factual or identity defect.
- **Complete coverage/implementation audit:** found Agnea’s Arrow, the partial upgrade rows and compound entries missed by the earlier single-name audit. It authored seven independent full-corpus regression cases. Its validator findings (duplicate scoped rows, missing identity fields and inappropriate descriptions on unresolved rows) were fixed and tested. The final audit found no outstanding implementation issue.

The source notes/evidence remain optional UI details; no generic “unverified” banners were restored to the main reading path.

## Verification

- **796 frontend tests across63 files**, full single-worker run, zero failures. All766 previous cases retained; old gap-count assertions now reflect researched coverage.
- **172 Python tests**, zero failures, including three new note-import safeguards.
- **7 Node artifact tests**, zero failures, including a new stale-research snapshot guard.
- **975 total checks**. TypeScript and production build pass. Runtime/index packing still reconstructs every imported field exactly. No dependency added.
- Desktop plus390px and320px checked on isolated preview5184. Verified researched effects, historical-name notice, compound descriptions, closed provenance, source selection and genuine Lend Resistance handling. Browser console error log empty during checks. Normal5173 saved data was not used or cleared.
- Six protected artifacts match the prior release byte-for-byte: source workbook, companion snapshot, original growth JSON, original import report, weapon families and mount-growth rules. Source namespace unchanged. Original64 profiles and59 selectable classes retained.

Evidence lives in `work/ability-research-2026-10-29/`: full frontend JSON/log, Python/Node/build logs, protected hashes and desktop/mobile screenshots. Independent research notes are in `work/research/upgrade-description-audit.json`.

## Local use

Refresh [the existing planner](http://127.0.0.1:5173/). If needed, run:

```powershell
cd fortune-weave-planner
pnpm dev --port 5173
```

Reproduce checks with `python -m unittest discover -s tests -v`, `pnpm exec vitest run --maxWorkers=1 --minWorkers=1`, `pnpm test:data`, `pnpm exec tsc -b --pretty false`, and `pnpm build`. Regenerate only derived spreadsheet artifacts with `python scripts/import_community_reference.py` and `pnpm pack:community`. Web research is a separate reviewed supplement; a changed source snapshot requires a new review rather than automatic remapping.

## Changed source and documentation files

- `ABILITY_RESEARCH_REPORT.md`
- `INTEGRATION_GAPS.md`
- `README.md`
- `scripts/community_artifact.test.mjs`
- `scripts/import_ability_info.py`
- `scripts/pack_ability_info.mjs`
- `src/abilityCoverageAudit.test.ts`
- `src/AbilityDescriptionResearch.test.tsx`
- `src/AbilityEffect.tsx`
- `src/abilityInfo.test.ts`
- `src/abilityInfo.ts`
- `src/AbilityPlanningShortlist.tsx`
- `src/abilityResearch.test.ts`
- `src/abilityResearch.ts`
- `src/data/ability-info-runtime.json`
- `src/data/ability-info.json`
- `src/data/ability-research.json`
- `src/data/community-core.json`
- `src/data/community-runtime.json`
- `src/MainBuildOverview.tsx`
- `src/ProficiencyProgression.tsx`
- `src/shortlistText.ts`
- `src/styles.css`
- `tests/test_ability_info.py`

Production `dist/` was rebuilt. Exact archive member hashes are recorded in the release manifest. Previous release archives were preserved.
