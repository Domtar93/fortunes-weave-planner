# Fortune’s Weave Build Planner — project history

This is the planner's former README, kept as a development log. Relative links start with `../` so they resolve from the `docs/` folder. On November 22, 2026 the old reports, screenshots and `work/` history moved to the sibling `fortune-weave-planner-archive` folder (links to them now name the archived file), and local machine paths in commands were shortened to `python` / `pnpm`. Counts, dates and commands below describe the state at the time each section was written. For the current overview, see the [README](../README.md).

## Launch features — November 21–22, 2026

- Character portraits (official art, credited in the footer and README) in the unit card, character reference, Current build bar, comparison slots and saved builds; Eshmel shows initials.
- Shareable build links (`#build=…` in the URL, never stored), Stats by level small-multiple charts with a table view, a Find a character growth filter, and level carry-over between characters.
- Publishing: relative `base`, GitHub Pages workflow, social preview image and meta tags, web manifest, icons, a build-generated offline service worker, and a Data correction issue form linked from the footer when `VITE_REPO_URL` is set.
- No saved-build, preset or export format changed.

## Automatic average stats, November 12, 2026

**1,101 checks passed**: 910 frontend, 184 Python and seven Node checks. TypeScript and production build pass. Desktop/mobile visual checks remain pending because computer control cannot initialize.

Choose a character, class and **Average stats at level** to see all nine total averages immediately. Published level-1 bases now cover all 64 selectable profiles; no manual checkpoint is required. Expected Growth keeps the percentage breakdown, while optional comparison/custom-start controls sit below the results. Existing growth data, saved builds and exports are unchanged. [Automatic-average report](AVERAGE_STATS_FIX_REPORT.md) documents sources, the Bonaventure Speed disagreement, formulas and verification. Recruitment autoleveling and mount/equipment bonuses are outside this simple baseline.

Rebuild the separate starting-stat JSON with `python scripts/import_character_bases.py`, or verify it with `python scripts/import_character_bases.py --check`. Both use local read-only source snapshots without network access.

## Previous — Increment 24: Expected Stats by Level, November 12, 2026

Added session-only target levels and character-scoped checkpoints/actual observations to the main builder, with separate Expected Growth and My Stats vs Expected displays. No starting stats are invented; saves, source data and existing calculations are unchanged. **890 frontend + 172 Python + 7 Node = 1,069 passing checks**, including 53 new cases. TypeScript and production build pass. Desktop/390px/320px visual checks remain pending because local browser use is disabled in Work settings. Completion report (archived `INCREMENT_24_REPORT.md`) records formulas, source research, validation, tests and the outstanding verification. The older backup/import Increment 24 report is preserved under its descriptive filename; later existing features remain intact.

## Previous data verification and planning UI — November 1, 2026

Reviewed 63 personal fields/123 named effects, separated all 55 multiline equippable entries, recovered 20 mount-skill descriptions, and documented Lend Resistance's effect while retaining its disputed unlock. The planning UI now has inspector Add/Remove, plan jump/back, compact sticky navigation and keyboard focus improvements. **837 frontend + 172 Python + 7 Node = 1,016 passing checks**; TypeScript, production build and desktop/390px/320px checks pass. Original source data, identities, saves and calculations remain unchanged. Verification/UI report (archived `VERIFICATION_UI_REPORT_2026-11-01.md`) lists changes, audits and unresolved information. Earlier checkpoint results below are historical.

## Previous ability research and audit — October 29, 2026

The planner now includes97 reviewed web descriptions,60 restored spreadsheet effect notes and readable compound ability descriptions. Both independent audits pass. **796 frontend +172 Python +7 Node =975 passing checks**; TypeScript, production build and desktop/390px/320px checks pass. [Research/audit report](ABILITY_RESEARCH_REPORT.md) lists every changed file, references and the three genuine unresolved mechanics. Known values remain visible for the two unverified upgrades; Lend Resistance retains an explicit conflicting-record notice. Original source bytes, saved identities and growth calculations remain unchanged.

## Previous UI rework — October 29, 2026

The planner is organized into **Build, Abilities, Compare & saves, and Reference**. Ability information leads with name, exact rank and the supplied effect; source comparisons and research labels are closed details. Known cell notes, combat-art effects and spell facts now enrich both workbook choices and exports without changing saved identities or calculations.

**766 frontend + 169 Python + 6 Node = 941 passing checks**, with TypeScript, production build and desktop/390px/320px verification passing. See UI rework report (archived `UI_REWORK_REPORT.md`) for changed files, coverage and remaining data gaps, and UI design notes (archived `UI_REWORK_DESIGN.md`) for the specialist's information hierarchy. Earlier reports below retain historical results.

## Previous audit follow-up — source comparisons, combat-art links and recovery

All three remaining auditor suggestions are implemented: same-rank original/additional comparison; context-aware combat-art links and exact local navigation; and reviewed reference recovery into new saved copies. Changed source snapshots require an explicit reviewed-import flag. Existing original sources, saved schemas and source namespaces are unchanged.

**742 frontend + 161 Python + 5 Node = 908 passing checks**, TypeScript/build and desktop/390px/320px checks pass. See the implementation report (archived `AUDIT_IMPROVEMENTS_REPORT.md`) for every file and evidence, and the [reference refresh guide](REFERENCE_REFRESH_GUIDE.md) for backups, the new-source acceptance flag and non-destructive recovery. Earlier reports below retain their historical results.

## Previous release — source-backed planning, October 28, 2026

The additional community sheet is integrated as separate evidence: personal descriptions/recruitment/boons/bloodmarks; all **5,481 learnset cells** across12 categories with source-specific shortlist/save/navigation; all27 offline reference worksheets including forging steps/costs and the new catalogs. Update from Main previews and confirms saved-loadout replacement. Full-plan comparison now has a separate documented mount-growth table. Existing original sources, growth calculations, IDs and tests are preserved.

**711 frontend + 155 Python + 5 Node = 871 passing checks**, TypeScript and production build pass. Desktop and390px/320px checks pass. A separate agent found two defects (header hierarchy and missing lazy-sheet freshness checks); both are fixed and independently rechecked. See completion report (archived `COMPLETION_REPORT_2026-10-28.md`) and independent audit (archived `INDEPENDENT_AUDIT.md`) for every file, evidence, suggested improvements and limits.

The original64 profiles/59 classes remain the playable planning set. Additional source variants/NPCs/datamines are reference-only. Game mechanics not established by the sources remain unavailable. Future snapshot refreshes need a reviewed migration plan because new-source ability references include a snapshot-specific identity. No automatic source refresh or save remapping is performed.

The sections below retain earlier checkpoint history.

## Previous QA refinement — mounts beside Class

Mounted classes now reveal **03 Mount** directly below **02 Class**, with a synchronized nine-stat preview. Consistent omissions display **+0%*** using an explicitly labeled workbook interpretation; raw blanks remain intact and Meganius stays disputed. The workbook lists 18 totals of 25% and four totals of 30%, so no 25% cap is applied. **678 frontend + 142 Python + 3 Node = 823 passing checks**, with TypeScript/build and desktop/390px/320px checks passing. See the mount QA report (archived `MOUNT_QA_REPORT.md`) for every file, source evidence, screenshots and limits.

A standalone local React, TypeScript, and Vite application. Includes character and class selection, nine growth percentages with a personal + class = combined breakdown, collapsible class details, and character ability names and recruitment notes for all four routes. It uses only bundled JSON at runtime. No database, authentication, hosting, or external API is required.

## Latest checkpoint — full build planning and optimized data

Full Build Loadouts explicitly save character/class, equipment and ordered ability source references. Local JSON backup/import previews additions and blocks conflicting overwrites. Compare Full Plans shows Main and saved plans without loading them. The separate Documented Mount Growth Preview uses narrowly validated workbook formulas; blanks remain unknown, disputes remain blocked, and original character + class outputs are unchanged.

**142 Python + 666 frontend + 3 Node artifact checks = 811 passing tests.** All original 652 cases remain. TypeScript and production build pass. Desktop and 390px/320px manual checks cover persistence, management, import, comparisons and mount evidence. Runtime data reconstructs every source field exactly. Four cacheable data chunks remove the previous large-chunk advisory without changing its threshold or adding dependencies.

See the saved completion checkpoint (archived `COMPLETION_CHECKPOINT.md`) and Increment 23 (archived `INCREMENT_23_REPORT.md`), 24 (archived `INCREMENT_24_BACKUP_IMPORT_REPORT.md`), 25 (archived `INCREMENT_25_REPORT.md`), 26 (archived `INCREMENT_26_REPORT.md`), 27 (archived `INCREMENT_27_REPORT.md`) for changed files, commands, evidence, tradeoffs and unresolved source issues. Existing character/class presets retain their original schema. Unsaved choices still reset on refresh; saved full plans load only on explicit request.

## Increment 22 history — download main build overview

**Download .txt** now sits beside Copy Build Overview and receives the exact same shared formatter string. It reuses the existing UTF-8 Blob/object-URL lifecycle and safe filename policy, including distinct Mu profiles. Success says **Download started.**; detected failures offer the selected manual-copy fallback without changing the clipboard. Empty equipment/ability plans remain exportable. **130 Python + 522 frontend = 652 tests passed** with the unchanged 15-second budget; TypeScript/build and desktop/390px/320px checks passed. The real 4,673-byte Alexandra download (archived `alexandra-main-build.txt`) exactly matches the prior Copy sample. See Increment 22 report (archived `INCREMENT_22_REPORT.md`) for every changed file, limitations and evidence. Source data, calculations and saved presets are unchanged.

**Copy Build Overview** exports the current main character/class, session equipment, ordered planned abilities, documented compatibility, source links and uncertainty warnings. It uses a pure typed formatter over the existing derived overview and shares verbatim ability-entry formatting with Copy/Download Shortlist. Clipboard success appears only after the write resolves; denied or unavailable access offers a focused, selected readonly text fallback. Empty equipment and ability plans remain exportable. No persistence, preset schema, calculations or source data changed. See Increment 21 report (archived `INCREMENT_21_REPORT.md`), the complete sample export (archived `main-build-overview-copy-example.txt`) and `copy-build-overview-*.jpg` for verification and limitations. Full-build TXT download is completed by Increment 22; this paragraph records Increment 21 behavior. Verification: **130 Python + 492 frontend = 622 passing tests**, TypeScript and production build passed; desktop/390px/320px checks passed. The original 15-second timeout remains; one older four-profile test is now two equivalent character-pair cases.

Increment 20 added **Main Build Overview**, a compact read-only projection of existing main build state. See `INCREMENT_20_REPORT.md` for its implementation history and baseline 591 tests.

Increment 19 added **Selected Mount** using all 22 existing records, exact source identity, species context, shared written/numeric evidence and filtered catalog navigation. See `INCREMENT_19_REPORT.md` for its verification history.


Increment 18 added **Selected Battalion**: all 69 records, character-scoped session choices, column-L-only class context and filtered catalog navigation. See `INCREMENT_18_REPORT.md` for its verification history.


Increment 9 added **Dungeon Chests & Rewards**: 31 locations and 90 chests with paired Part I/III rewards, search/phase/reward/unresolved filters, source-cell links, sparse chest numbering and separate community notes. Five unambiguous location-name references support navigation to/from Magic Scrolls without equating reward labels. See `INCREMENT_9_REPORT.md` for every changed file, 248-test results, parsing details and cross-sheet discrepancies. Earlier reports retain the implementation history.

Increment 10 adds **Weapons & Forging**: 91 main weapon records, five separate preliminary contributions, name/effect/combat-art searches, completeness/source-difference filters, raw source inspection and explicit version comparisons. Might spans are endpoints only; missing numbers stay unknown and zeros remain valid. No weapon effects or forging formulas enter builds. See `INCREMENT_10_REPORT.md` for all changed files, 283-test results and source issues.

Increment 11 adds bidirectional exact-name **weapon ↔ dungeon** navigation: 14 reward occurrences for 13 weapons, 12 separately labeled noninteractive refined candidates, origin/source context and focused chest/phase destinations with retained filters. No source data or preset schema changed. See `INCREMENT_11_REPORT.md` for the full audit, changed files, 318-test results and parallel-timeout note.

Increment 12 adds **Ability Planning Shortlist**: eight organizational slots per main-planner character, source-based Add/Remove actions in Proficiency Progression, button reordering, confirmed clearing, exact ranks and evidence/glossary inspection. Plans live only in React state, reset on refresh, and keep both Mu profiles separate. Eight is a UI capacity; equip limits and legality remain unverified. See `INCREMENT_12_REPORT.md` for every changed file and all 345 passing tests.

Increment 13 adds **View in Proficiency Progression** to each shortlisted entry. It opens the existing browser at the exact source record, retains search/rank filters while temporarily revealing hidden targets, updates inspection and focuses a briefly highlighted row. Both Mu profiles remain independent. No persistence, gameplay calculations or source data changed. See `INCREMENT_13_REPORT.md` for all files, evidence and **375 passing tests**.

Increment 14 completes the round trip with **Return to Shortlist**. The existing source ID locates the originating card after reordering, reopens the panel, and focuses a temporarily labeled target. Removed/cleared/stale entries show a nonfatal message and a panel-only fallback. Search, rank filters, both Mu identities, saved presets and calculations stay intact. See `INCREMENT_14_REPORT.md` for every file and **393 passing tests**.

Increment 15 adds **Copy Shortlist**: ordered plain text for the selected profile with exact names/ranks, evidence, reliability, source cells/URLs and available glossary caveats. Clipboard success is announced only after the write resolves; denied or unavailable clipboard access shows selected readonly text for manual copying. Empty lists disable copying. Both Mu identities, session reset, saved presets and source data are preserved. See `INCREMENT_15_REPORT.md` for every file and **412 passing tests**, and `shortlist-copy-example.txt` for a complete actual export.

Increment 16 adds **Download .txt** beside Copy. Both actions use the exact same formatter output; the formatter is unchanged. A UTF-8 Blob, temporary anchor and cleaned-up object URL start a local download with a safe profile-specific filename. Empty lists disable the action; detectable failures show the existing manual-copy fallback. Feedback says Download started, without claiming disk storage. See `INCREMENT_16_REPORT.md` for every changed file, **439 passing tests**, mobile checks and limits; `alexandra-ability-shortlist.txt` is the actual downloaded example, byte-for-byte equal to Copy's example.

Increment 17 adds **Selected Weapon** to the main builder: all 91 canonical weapons, name search/family filters, source statistics and differences, provisional family evidence, three-state class-list context and existing exact dungeon navigation. Choices are character-scoped and session-only; both Mu profiles stay separate. Weapons never change growths, Build A/B or saved presets. Five preliminary records remain evidence only. See `INCREMENT_17_REPORT.md` for every changed file, source boundaries, checks and limitations.

## Launch in this workspace

Dependencies are already installed. Run these exact PowerShell commands:

```powershell
cd fortune-weave-planner
pnpm dev --port 5173 --strictPort
```

Open http://127.0.0.1:5173 in a browser. Press Ctrl+C in the terminal to stop. If a server is already running on that port, use it or stop it before launching another instance.

## Portable setup

Requirements: Node.js 22 or newer, pnpm 11.25.0. Python 3.10 or newer is needed only for reimporting and importer tests, not for using the app. Install pnpm using the official pnpm instructions if it is not on your PATH.

```powershell
pnpm install --frozen-lockfile
pnpm dev --port 5173 --strictPort
```

Pinned versions and `pnpm-lock.yaml` make dependency installation reproducible. `pnpm-workspace.yaml` allows the esbuild setup script using the [pnpm 11 build configuration](https://pnpm.io/blog/releases/11.0).

For the production build:

```powershell
pnpm build
pnpm preview --port 4173 --strictPort
```

Open http://127.0.0.1:4173. Vite serves only on the loopback address. The `dist/` files can be served by another local static server; opening `index.html` directly with `file://` is not the launch workflow.

## Structure

```text
data/
  source.xlsx              Read-only copy of the corrected Excel export
  import-report.json       Counts, cell-specific validation, formula evidence, research queue
scripts/
  import_data.py           Workbook validation and JSON generation
  import_proficiencies.py   Matrix/original-sheet reconciliation, coverage audit, glossary
  import_mounts.py          Raw mount fields, parsed annotations and validation
  import_battalions.py      Battalion distributions, raw fields, flat parsing and independent notes
  import_scrolls.py         Seven scrolls, raw/numeric validation, acquisition states and separate notes
  import_dungeons.py        Paired phase rewards, sparse chest numbering and associated/independent notes
  import_forging.py         Main/preliminary weapons, documented endpoints, raw evidence and source differences
  import_weapon_families.py Read-only source-section validation and separate provisional family sidecar
src/
  data/growths.json         Generated source snapshot in percentage points
  growths.ts               Types, stat order, formatting, addition
  App.tsx                  Character planning page
  CharacterDetails.tsx     Selected character’s ability names and four recruitment routes
  ClassDetails.tsx         Collapsible selected-class reference, XP, and separated stat tables
  ProficiencyProgression.tsx Selected-character rank browser and ability inspection
  proficiencies.ts         Typed learnset model, exact Mu mapping, filters and class context
  AbilityPlanningShortlist.tsx Collapsible character-scoped plans, ranks, sources and controls
  shortlist.ts             Pure session reducer, source-record identity and candidate guard
  shortlistText.ts         Pure ordered text export with exact profile/evidence/citations
  shortlistText.test.ts    Formatter order, equal-name paths, Unicode, Mu and evidence regressions
  ShortlistCopy.tsx        Clipboard action, awaited feedback and selectable manual fallback
  ShortlistCopy.test.tsx   Clipboard failures/success, keyboard, lifecycle and isolation tests
  shortlistDownload.ts    Safe filenames and local Blob/anchor download of existing formatted text
  shortlistDownload.test.ts Filename safety, UTF-8 bytes and object URL/anchor cleanup
  ShortlistDownload.test.tsx Shared Copy/Download content, failures, Mu, state and preset regressions
  AbilityPlanningShortlist.test.tsx Shortlist interactions, session lifecycle and isolation
  shortlist.test.ts        Source identities, eligibility, capacity, evidence and data integrity
  proficiencyNavigation.ts Exact shortlist-source resolution and ephemeral request types
  proficiencyNavigation.test.ts Source targets, stale/missing/duplicate IDs and mapping
  ShortlistProficiencyNavigation.test.tsx Destination focus, filters, keyboard, expiry and regressions
  ShortlistReturnNavigation.test.tsx Return identity, reordering, removal, focus, fallback and regressions
  MountBrowser.tsx          Mount catalog, details and selected-class compatibility
  mounts.ts                Typed mount data, filters and source-type classifications
  BattalionBrowser.tsx     Battalion catalog, details, filters and selected-class context
  battalions.ts            Typed battalion data and source-only class support
  MagicScrollBrowser.tsx    Scroll search, acquisition filters and reference inspection
  scrolls.ts               Typed scroll model, acquisition labels and catalog filtering
  DungeonBrowser.tsx        Searchable dungeon catalog, paired table/mobile cards and source notes
  dungeons.ts              Typed locations/chests/rewards and phase-aware filters
  WeaponForgingBrowser.tsx  Searchable weapon catalog, comparisons and independent notes
  forging.ts               Typed weapon fields, completeness and source-conflict filters
  data/weapon-families.json Generated provisional family evidence for 91 canonical weapon IDs
  weaponPlanning.ts        Strict family/class-list comparison, filters and session selection reducer
  weaponPlanning.test.ts   Section counts, aliases, unresolved context and profile-state regressions
  SelectedWeapon.tsx       Main character's searchable weapon slot and shared source inspection
  SelectedWeapon.test.tsx  Properties, class context, acquisition, Mu, presets and shortlist isolation
  WeaponReference.tsx      Shared properties, acquisition and source evidence used by both weapon views
  catalogReferences.ts     Unambiguous location-name navigation and source range URLs
  catalogNavigation.ts     Open/focus target headings or chest/phase cells independently of builds
  weaponDungeonReferences.ts Pure exact/candidate/ambiguous/unmatched weapon reward audit
  weaponDungeonReferences.test.ts Source counts, boundaries, ambiguity, suffixes and data integrity
  WeaponDungeonNavigation.test.tsx Bidirectional focus, filter retention and planner regressions
  dungeons.test.ts         Model, source URL and conservative cross-reference tests
  DungeonBrowser.test.tsx  Catalog, phase filters, notes, navigation and build-isolation tests
  MagicScrollBrowser.test.tsx Scroll browser, preset integration and growth-isolation tests
  scrolls.test.ts           Unicode search, properties, filters and note isolation
  BuildComparison.tsx      Independent builds, delta table, breakdowns and concise class context
  comparison.ts            Typed comparison composition around combineGrowths
  BuildPresets.tsx          Named preset manager and targeted loading controls
  presets.ts               Versioned localStorage model, validation and safe writes
  presets.test.ts           Persistence, corruption, version and storage-failure tests
  BuildPresets.test.tsx     Preset operations, targeted loads and recovery UI tests
  styles.css               Responsive interface
  main.tsx                 React entry point
  growths.test.ts           Source-value and calculation tests
  App.test.tsx             Selector interaction and breakdown tests
  CharacterDetails.test.tsx Character-reference interaction and evidence-state tests
  ClassDetails.test.tsx    Class detail, selection, units, and missing-data UI tests
  ProficiencyProgression.test.tsx Rank, filter/search, glossary, mapping and context tests
  MountBrowser.test.tsx     Mount catalog, source integrity and compatibility tests
  BattalionBrowser.test.tsx Battalion fields, filters, class context and regression tests
  comparison.test.ts       Known examples, delta/swap invariants and invalid-input tests
  BuildComparison.test.tsx Comparison controls, isolation, context and regression tests
tests/
  test_import_data.py       Importer regression and failure tests
  test_class_details.py     Class mapping, validation, row discovery, and source regressions
  test_proficiencies.py     Original ranks, matrix reconciliation and evidence regressions
  test_mounts.py            Mount values, missing data, parsing and validation regressions
  test_battalions.py        Battalion source/distribution controls and parser regressions
  fixtures/character-details.reference.json  Expected raw text from the supplied reference package
```

## Read-only import

`data/source.xlsx` is a byte-for-byte copy of the corrected workbook from Downloads. The original workbook and the project’s source copy are never saved or edited by the importer. The linked Google Sheets working copy is background provenance, not a runtime dependency or the final import input.

Original working copy: https://docs.google.com/spreadsheets/d/1Xl84UvuBz3sGWOaGCny2i5wMIk2H__c3BDnMO_GeDQ0/edit

The importer opens Excel with `openpyxl` in read-only mode and reads:

- Characters: names in A, growths B:J, ability names W:X, four recruitment routes Y:AB, starting row 3. Row 42’s repeated Name/stat header is explicitly excluded. Header validation also protects the character-text column mapping.
- Classes: scan the worksheet to discover named rows rather than using a fixed final row. The current snapshot has 59 named classes through row 61, with the final populated row at 69. Untitled single-cell F-column annotations are retained separately in the import report, even if a later class is appended after them. Unnamed structured class rows are errors; valid named classes beyond row 62 are read and included in count reconciliation.
- Research Queue: retains all 19 entries in the report and surfaces the unresolved growth dispute in JSON and the UI.
- Proficiency Matrix: all 4,284 records reconciled by exact character/category/rank and source address with the original 12 sheets. Original rank headings determine each category's progression; editorial headings such as “S+ always …?” do not create new ranks. Proficiency Coverage totals are checked against matrix evidence labels. Ability Glossary preserves all 322 raw names, available descriptions, evidence, notes and references.
- Mounts: 22 named records at rows 2–23; A:G text, H:P numeric growths, and Q's original total formula/value. Source headings and record count are validated. Eighteen independent annotations below the table are retained separately, along with the ability-alternative warning at `Character Learnsets!I6`.
- Battalions: 69 named records at rows 2–70, A:G raw reference fields. Headers, duplicate/missing names, ranks, categories, numeric gather values and expected distributions are validated. All 25 populated reference cells from H onward are retained as an independent notes block, including I:K's rank/Normal/Affinity table; their row positions never attach mechanics to battalions.

Validation covers required sheets and headers, missing/invalid names, duplicate names (case and whitespace insensitive), missing or malformed growths, finite numbers, and expected counts. Text such as `.` or a numeric string is rejected. Actual numeric Excel percentage cells are converted from ratios to percentage points. Plain numeric cells are preserved. Zero, negative, fractional, and values over 100 are allowed. Source cells containing formulas are flagged rather than evaluated or substituted.

The frontend JSON has explicit stat keys checked against TypeScript types. Schema version 2 adds character `personal` and `recruitment` fields, each with raw text, evidence status, and a cell address. Each profile also retains its workbook sheet, row, and growth range. The report and JSON include a SHA-256 hash of the source. Reimporting identical bytes produces identical JSON without timestamps.

Schema version 2 now also includes an additive class `details` object. B:L hold recorded requirements, mastery/abilities and descriptions, and allowed weapons/skills; M:X hold twelve proficiency XP fields; AH:AP hold nine flat stat bonuses; AZ/BA hold movement and mount classification. The importer validates the source headings, including L’s merged L1:L2 heading. Every detail field retains its source address. Class text preserves the original whitespace and line breaks.

For proficiency XP, a blank remains `value: null` and means **not listed as usable**. Numeric zero remains zero and means **usable with no bonus XP**. Positive values are bonus XP. Blanks never become zero. Missing flat bonuses or movement remain unknown; malformed numeric fields fail validation. Growth Y:AG remains separate from flat AH:AP bonuses, and incomplete AQ:AY base stats are excluded from calculation inputs.

The class panel has four independently collapsible sections: requirements/restrictions, mastery/abilities, allowed types/proficiency XP, and growth/flat bonuses. License, level, renown, movement, and mount type stay visible in a compact summary. Open sections remain open when the selected class changes. Primary/secondary proficiency requirements are recorded examination inputs; the panel does not enforce hard eligibility or calculate certification probabilities.

Character text follows the reference package’s W:AB mapping, which was checked against all 384 selected fields in the existing source. Populated community entries are unverified, blank cells are unknown, and explicit `-`/`N/A`/`None` markers are unavailable. Raw markers and line breaks are retained. Formula/error/non-text fields fail import rather than being turned into invented ability or recruitment text. The UI also supports a confirmed status for future independently verified data; no current character-text entry is automatically marked confirmed.

The additive `proficiencies` snapshot keeps both original cell text and matrix text, the source cell, matrix row, original evidence label, verification note and source URL. Twenty matrix cells trim surrounding whitespace; both exact versions survive. Missing records, duplicate keys, unknown names, changed source references, mismatched text, malformed literals, rank/coverage discrepancies and invalid glossary records fail validation. No other character aliases are applied.

The only learnset mapping is explicitly `Mu (with growth)` → `Mu`; all 64 growth profiles remain separate. There are 63 original learnset identities across all 12 categories. Of 4,284 rank cells, 2,321 are documented/unverified, 1,871 unknown, 56 explicitly unavailable, nine unresolved placeholders and 27 compound entries requiring review. These classifications preserve the matrix's evidence label separately; commas, slashes, newlines and qualifiers are kept verbatim instead of split or moved to another rank. Whitespace-only source cells are unknown. There are 2,357 populated unlock cells, including placeholders and compounds; this is not a verified-ability count.

The browser has all-ranks, documented-only and unknown/unresolved filters plus ability-name search. Ability inspection uses exact glossary names (with surrounding whitespace ignored only for lookup). The glossary contains eight descriptions, all unverified; missing effects are shown explicitly. Class allowed-type text and XP appear independently, including source qualifications and Dancer's conflict. Neither XP blanks nor absent allowed-type tokens establish a prohibition; class selection never suppresses rank entries. No equip legality, training simulation or optimization is implemented.

The additive `mounts` snapshot preserves every original text field with evidence and a source cell, and stores parsed stat tokens and row validation findings separately. Duplicate names, missing names/types, malformed numerics/formulas, bad headers and count mismatches fail import. Unknown species, missing/ambiguous acquisition conditions, unsupported text parsing and growth discrepancies are warnings. Raw mount names remain available even where display names trim surrounding whitespace (Red Falicorn).

There are six Ornius, six Horse, six Pegasus, three Bau and one Elephant records. Numeric mount growths contain 71 recorded values and 127 unknown blanks, with no explicit zeros in this source. A recorded numeric zero would remain zero and unverified; blanks never become zero. Source Q totals use SUM formulas and are retained without evaluation, rather than used to assert missing bonuses. Flat stat points, written growth percentages and numeric growth percentages remain separate.

Meganius differs between written E4 and numeric H4:P4: Dex +5% versus +15%, Def +15% versus blank, and Res unlisted versus +5%. Both versions are shown, with highlighted rows and a warning. All mounts stay searchable/inspectable regardless of conflict or class type. Class compatibility compares recorded BA text to the mount's species: match, mismatch, explicit No/unmounted, or unknown. These are workbook classifications, not verified game legality. Character changes preserve the mount, filters and search.

Mount abilities may be alternatives; `Character Learnsets!I6` explicitly says “Only one option, not both.” Column G is an independent community reference-note field and is never assigned as an effect of the mount's column C abilities. Acquisition text is unverified; Saramis War Elephant retains its uncertain Part III/Cai condition. Bonding, ability activation, movement/Canto effects, Charioteer multipliers, equipment effects and mount growth calculations are not implemented.

The additive `battalions` snapshot preserves exact raw text, field-level cells, original sheet/row/range, a stable name-derived ID, unverified reliability and separate validation findings. All 69 source stat strings parse unambiguously into 248 flat modifiers; 373 omitted stat fields remain null. Compact tokens such as `Mag+2` and the explicitly supported `Luck` → `Lck` alias are recognized without editing source strings. A missing, malformed, ambiguous or duplicate-stat entry exposes no partial numerical approximation. Source formulas/errors/non-text values in literal text fields fail validation. Missing ability/acquisition fields and ambiguous acquisition/stat text are warnings; the current battalion source has no additional warnings.

The browser combines name search, four category filters, exact required-rank filtering and an optional class-support filter. Class context uses allowed types at L, Authority XP at T and mount classification at BA. The source has 39 unmounted classes listing Battalions and 20 mounted classes not listing them. A zero Authority XP bonus is preserved as usable without bonus experience; it never sets a character's actual Authority rank. Dismounting permission and definitive equip eligibility are not inferred. Character/class changes retain unrelated selections, and an inspected battalion remains open even when filtered out. No assumed character-rank input is needed for an exact catalog requirement filter.

Gather limit remains a raw gameplay field, without interpreting it as quantities, capacity or uses. Gambit mechanics are not inherited from character abilities or adjacent notes. Battalion flat points do not enter growth calculations or combat-stat stacking. The current 69/4-category/5-tier/gather distributions exactly match the requested controls; see the current report for counts.

On a validation error, the command exits with status 1, writes the diagnostic report, and leaves any previous frontend JSON in place. Review the report before relying on an earlier snapshot. Invalid rows never receive invented numerical defaults.

### Commoner / Noble

`Classes!Y3:AG3` is blank. The existing growth calculations at `Character Learnsets!D27:L27` use nine SUMIF formulas. For example:

```text
Character Learnsets!D27 =sumif(Classes!$A:$A,$D$4,Classes!Y:Y)
```

Excel’s SUMIF treats the blank values in this matching class row as zero. The importer recognizes and records all nine formulas before assigning zero to this exact all-blank class row. If the evidence is absent or changes, or the row is only partially blank, import fails. This is an explicit compatibility rule supported by the workbook’s calculations, not a general missing-data fallback or additional in-game verification.

### Counts and unresolved data

Imported **64 character profiles** and **59 classes**, matching the named workbook rows and expected counts. Both Mu and Mu (with growth) remain selectable, and The Avatar is included. There are no malformed required numerical values or duplicate names in the corrected workbook.

Research Queue `DATA-12` records conflicting Armored Ornius Rider Spd/Dex modifiers: +10/+5 versus +15/+10. The app preserves the workbook’s +10/+5, shows a note with that class selected, and retains the uncertainty in expandable workbook notes. No speculative correction is made.

Dancer has a source inconsistency: its allowed-type text includes Bow, but the Bow XP cell is blank and Axe has +2 XP. The importer preserves these independent source fields without inferring a correction or legality rule. The current class details also contain 89 blank text fields, which remain unknown. Three worksheet annotations request further equipment/combat-art/divine-skill research and are retained in the import report.

Of the 384 ability/recruitment fields, 345 are unverified community entries, six equippable-ability fields are unknown, and 33 route fields are source-marked unavailable. Ability names and route notes are displayed as references; ability effects, progression, and recruitment eligibility are not calculated. Mu and Mu (with growth) retain their own source rows.

## Reimport and test

With Python and pnpm on PATH:

```powershell
python -m pip install -r requirements.txt
python scripts/import_data.py
python scripts/import_weapon_families.py
python scripts/import_mount_growth_rules.py
pnpm pack:data
python -m unittest discover -s tests -v
pnpm test --maxWorkers=1
pnpm test:data
pnpm build
```

In this Codex workspace, the bundled Python is already available with openpyxl installed:

```powershell
python -X utf8 scripts/import_data.py
python -X utf8 scripts/import_weapon_families.py
python -X utf8 scripts/import_mount_growth_rules.py
pnpm pack:data
python -X utf8 -m unittest discover -s tests -v
pnpm test --maxWorkers=1
pnpm build
```

An alternate source can be specified explicitly:

```powershell
python scripts/import_data.py --source 'data/source.xlsx' --output 'src/data/growths.json' --report 'data/import-report.json'
```

The importer refuses output/report paths that resolve to the input workbook. Importer tests create temporary synthetic workbooks under `work/test-fixtures/`; they never change the source workbook.

## Calculation

For each of HP, Str, Mag, Spd, Dex, Def, Res, Lck, and Cha:

```text
combined growth = personal character growth + selected class modifier
```

These are growth percentages, not current character stats. There is no clamping to 0–100. Alexandra + Gladiator gives **40% HP** and **45% Strength**.

## Build comparison

The collapsible comparison starts with Alexandra/Gladiator in Build A and Alexandra/Hunter in Build B. Both sides offer all 64 profiles and 59 classes. Independent comparison state is held by App so the preset manager can target either slot; main changes do not overwrite it. **Load main planner into Build A** copies the current main pair into A only. **Swap builds** exchanges both complete selections, preserving totals and reversing nonzero differences. Closing/reopening the section retains its state within the current page session.

`compareGrowthBuilds` resolves each exact profile/class and calls the existing `combineGrowths` once per build. The UI renders these results; it does not duplicate growth addition. Difference is **B − A in percentage points**, with higher/lower/equal labels for each stat and no overall build ranking. Negative modifiers/totals and percentages above 100 remain valid. Invalid profiles or malformed growths produce errors, not invented zeros. Commoner / Noble uses the existing importer-validated zero data.

The contribution accordion shows personal/class/combined values and source ranges for both builds. Eight concise context fields per class show license, required level, primary/secondary proficiency requirements, mastery name, additional unlock restrictions, movement and mount classification. Raw multiline route conditions and missing-data labels are preserved. Source notes, including Armored Ornius Rider's dispute, appear next to the relevant comparison selectors. Context is descriptive; comparison does not establish certification eligibility.

Flat class bonuses, mount/battalion/equipment/combat-art effects, mount growth contributions and projected level-ups are excluded. The importer and source data remain unchanged.

## Named local presets

Open **My Character Builds**, choose Main planner, Build A or Build B as the save source, and enter a unique name. Each saved card has separate buttons to load Main planner, Build A or Build B. Saving changes no selections; loading changes only its target. Rename and duplicate require a nonempty name unique without regard to case. Delete uses an inline confirmation with Cancel focused first.

The dedicated key is `fortunes-weave.build-presets`. Payload and records use schema version 1. Each record stores `id`, `name`, `characterName`, `className`, `createdAt` and `updatedAt`, plus `schemaVersion`. Existing exact profile/class names are the source identifiers; Mu's two names remain distinct. Growths are resolved from the current imported data and validated through the existing calculation utility on every load. No copied source records, growths, mounts or battalions are stored.

Storage reads never write. Malformed JSON, invalid records, unknown fields or unsupported versions block mutations and leave the entire original value untouched. **Retry reading saved builds** only rereads storage after the issue is resolved; there is no automatic reset or lossy migration. Valid records whose source identifiers are no longer available remain listed with disabled Load actions, and can still be renamed, duplicated or explicitly deleted. Storage access/quota failures show errors without claiming a successful save. Before each write, the previous raw value is checked to detect another tab's changes. This is a best-effort stale-write check; localStorage has no atomic cross-tab compare-and-swap.

Presets belong to the current browser profile and app origin (scheme, hostname and port). Keep the same launch address to reopen them. Refresh reloads the preset list; it does not automatically restore unsaved current selections. No cloud sync or preset file export/import is implemented. The independent session shortlist supports text copying/downloading.

## Historical validation — Increment 17

- Python: **130 tests passed**; eight provisional-family import checks supplement all 122 previous cases. Original workbook, main snapshot and import report remain unchanged.
- Vitest: **365 tests passed in 30 files** using `pnpm test --maxWorkers=1`; 32 family/model/reducer and 16 Selected Weapon interaction cases supplement all 317 previous frontend cases. All **3,776** character/class pairings remain checked. All previous **439** cases remain; **495 total** now pass. Every existing test file/assertion is unchanged. The existing worker settings remain; the test budget is now 15 seconds for longer source-rich UI workflows on slower hosts. See `INCREMENT_17_REPORT.md` for the baseline timing investigation and earlier default-budget failures.
- TypeScript and Vite production build passed.
- Increment 14 browser check: Flying C+, all three requested Sword round trips, Rend Armor after reordering, removed-entry fallback, Enter/Space, retained filters and distinct Mu origins passed. Real refresh clears session state while existing preset contents/dates stay identical. Desktop 1366×900 and 390px/320px phones have no horizontal overflow; console warning/error check passed. Accessible focus, names, status/error semantics and unique IDs were checked; no dedicated speech-reader session was run. Production JS is 2,438.33 kB / 229.78 kB gzip, with the existing non-failing size warning. See `INCREMENT_14_REPORT.md` and `shortlist-return-*.png`.
- Increment 13 browser check: all six requested Alexandra Sword/Flying/Riding destinations, Enter/Space, repeated navigation, collapsed-panel opening, both hidden filters, source inspection and filter restoration passed. Mu profiles retain distinct IDs/growths. Real refresh clears plans/navigation while all three existing presets retain their exact displayed contents. Desktop 1366×900 and 390px/320px phones have no horizontal overflow; console warning/error check passed. Production JS is 2,435.20 kB / 228.77 kB gzip, with the existing non-failing size warning. See `INCREMENT_13_REPORT.md` and `proficiency-navigation-*.png`.
- Increment 12 browser check: Alexandra Sword/Flying/Riding, ninth-entry feedback, remove/reorder/confirmed clear, Sofia independence, class-change retention, separate Mu profiles and a real refresh were verified. All three existing saved presets retained their exact displayed contents and modification dates. Desktop 1366×900 and phone 390×900/320×900 have no horizontal overflow; no console warnings/errors. Source details and reorder/confirmation controls were checked on phones. Production JS is 2,431.89 kB / 227.84 kB gzip, with the existing non-failing size warning. See `INCREMENT_12_REPORT.md` and `shortlist-*.png` previews.
- Headless Edge: selection changes and uncertainty notes passed. All nine cards fit at 1440×900, 1366×768, and 1024×768. No horizontal overflow at widths 768, 390, or 320. No browser errors or external requests.
- Integration browser check: the nine-card grid still ends at y=718 on a 1366×768 viewport. The new reference panel was visually checked on desktop and phone layouts, unknown/unavailable character changes worked, and widths 390/320 had no horizontal overflow. No console warnings or errors were observed.
- Increment 2 browser check: manually verified Gladiator, Dancer, Armored Ornius Rider and The Avatar, including all collapsible sections. Desktop growth-grid bottom remains y=718 at 1366×768. Expanded class tables/requirements were visually checked at 1366px, 390px and 320px, with horizontal overflow checked against document client width (including the vertical scrollbar). Saved previews: `class-details-desktop.png` and `class-details-mobile.png`.
- Increment 3 browser check: Alexandra Sword/Flying/Riding, both Mu profiles, filters/search, Dancer's independent context and a multiline Eshmel compound were manually checked. Desktop and 390px/320px phone layouts have no horizontal overflow. Previews: `progression-desktop.png`, `progression-mobile-controls.png`, `progression-mobile.png`. The production JS now bundles the source-rich snapshot (about 2.02 MB / 172 kB gzip); Vite emits a non-failing chunk-size warning. No dependencies changed.
- Increment 4 browser check: all five species matches, a mismatch and an unmounted class, Wild Ornius/Horse values, Bucephalus/Foal separation, the elephant caveat, Meganius's three differences, filters and character-selection retention were checked. Desktop and 390px/320px layouts have no horizontal overflow; all nine growth cards still end at y=718 on a 1366×768 viewport. Browser console warning/error check passed. Previews: `mounts-desktop.png`, `mounts-growth-conflict.png`, `mounts-mobile-catalog.png`, `mounts-mobile.png`, `mounts-mobile-table.png`. Production JS is about 2.07 MB / 180 kB gzip; the existing non-failing Vite size warning remains.
- Increment 5 browser check: all four named battalions, exact Luck-source preservation, combined search/category/rank filters, optional class support, class/character selection retention and independent notes were checked. Desktop, 390px and 320px views have no horizontal overflow. Nine growth cards still end at y=718 at 1366×768. Browser console check passed. Previews: `battalions-desktop.png`, `battalions-details.png`, `battalions-mobile-controls.png`, `battalions-mobile.png`, `battalions-mobile-narrow.png`. Production JS is about 2.15 MB / 190 kB gzip, with the same non-failing size warning.
- Increment 6 browser check: Alexandra Gladiator/Hunter, Sofia's +15 Magic points, both Mu profiles, swap/load-main isolation, negative contributions, Armored Ornius warnings and full Dancer route restrictions verified. Desktop at 1366×900 shows both selectors and all nine rows together. The 390px/320px tables, contributions and context have no horizontal overflow; original main growth grid remains at y=718 on 1366×768. No console warnings/errors. Previews: `comparison-desktop.png`, `comparison-mobile-controls.png`, `comparison-mobile.png`, `comparison-mobile-narrow.png`. Production JS is about 2.16 MB / 192 kB gzip; the existing non-failing size warning remains.

## Next small increment

An optional next small feature is an explicit “Update from Main” action for an existing full loadout, with a before/after preview and confirmation. Certification, leveling, combat/equipment totals, equip legality, mount bonding and build optimization still require verified mechanics; they are not inferred from community descriptions.

## Magic scroll reference

**Magic Scrolls** imports `Magic Scrolls!A2:L8`, discovering named records rather than assigning side notes by row. All seven names and their Greek letters are preserved. IDs are deterministic hashes of exact names and survive row reordering. Every field carries its original raw value, Excel data type, confidence and cell reference alongside any parsed value. Numeric errors are warnings with unresolved/null parsed values, never zero defaults. Range is literal text; numeric/date/formula inputs are unresolved and are not converted into usable ranges.

Each part's acquisition state is separate: documented text (unverified), explicit `N/A` (unavailable), explicit `?` (unknown), blank (no source entry), or malformed (unresolved). Both part filters combine with name/archive search. Filtering or changing the main pairing retains the selected reference; an out-of-filter selection is labeled accordingly. All original line breaks and multiple acquisition methods remain visible.

Eight independent worksheet notes are preserved with cell provenance, including the two text annotations below the table at B12/K12. Trading chapters, ingredient locations, possible route/story locks and possible absence of Luna Λ remain unverified. They are not assigned to scrolls by row alignment. The catalog does not infer equip/learn/use legality from characters, classes or Reason/Faith rank, and it does not calculate combat or modify growths or saved-preset schemas.

Current scroll validation: 7 records, 42 parsed numeric fields, 7 literal ranges, no import errors. Part 1 has four documented entries and three N/A entries. Part 3 has three documented entries and four `?` entries, with four corresponding warnings. All populated community data remains unverified.

## Dungeon chests and rewards

The read-only **Dungeon Chests & Rewards** panel has 31 locations, 90 populated chest cells and 180 phase fields. Each source cell is one chest: line one is Part I, line two is Part III. Raw cell/line text stays exact, including whitespace, Unicode and upgrade suffixes. Blank chest columns create no chest; Uncharted Isle therefore has Chest 2 only. The four Part I `-` fields at Palace of Sand are placeholders, not obtainable items or proof that chests do not exist. Unexpected line counts preserve the raw cell and leave both phase assignments unresolved.

Location/reward search normalizes incidental whitespace and case only. A separate reward filter finds locations containing that reward. The phase selector controls which rewards are searched and shown; unresolved filtering includes dash placeholders, empty phase fields and malformed cells. Desktop uses a comparison table; phones show stacked chest cards with retained accessible table semantics. The new catalog renders its body on first opening and retains its state afterward.

Six column-G notes and the explicitly named Enno Isle footer form seven location-specific notes. The 29 other legend/discussion/footer cells remain separate. Route, story-lock and Grand Megalith notes are descriptive community references, not access checks. The uncertain Archive Τ discussion at H26/H27 is not assigned to Rubess Forest or Uncharted Isle.

Scroll acquisition text supports five exact location-name matches (case/whitespace normalized). Navigation opens and focuses the target, retaining filters and builds. No alias, translation, archive/spell or Greek/Latin equivalence is inferred. In particular, Uncharted Isle's table lists only Talisman in Part III, although Dark Spikes Τ's scroll acquisition mentions that island; Southern Passage retains `Swarm Z`, separate from the scroll name `Swarm Ζ`. Both sources remain unchanged. Cell links open the original named worksheet range in Google; they are optional outgoing links, not runtime data fetches.


## Weapons and forging reference

**Weapons & Forging** uses the read-only Forging worksheet: 91 main rows (19–109), five earlier source contributions (2/4/6/9/15), four exact-name links and one unmerged Veronique/Veroquine candidate. The browser combines independent name, effect and combat-art/note searches with numeric-completeness and source-difference filters. Selected inspection and queries survive filtering, collapse and pairing/preset changes. Optional descriptions may be absent even in a complete numeric record. Four weapons lack primary combat stats; Silver Spear additionally lacks durability. Missing values display Not documented, never zero.

Every field preserves its source value, cell, Excel type and number format. Might spans have documented endpoints only; the single Ursa's Right Claw Might and zero maximum refinement remain valid. Fifteen date-encoded ranges retain their ISO/date format/serial and display the source's explicit d-m format, such as Levin Sword's 1-2. Unknown date encodings remain unresolved. Only five literal-constant formulas are read; no general Excel expressions are evaluated.

Zanbato's preliminary 7-19 and main 14-19 Might, Wooden Sword wording, Silver Spear missing-data differences, Da Mina spacing and the spelling candidate remain visible with both source rows. Five K-column notes stay independent and unverified. The general observation about halfway/full-refine effects establishes no per-weapon unlock stage. No weapon type, progression curve, equip legality, damage, attack speed, effect calculation or preset change is inferred. All pre-existing JSON sections and workbook bytes remain unchanged.

Desktop 1366×900 and phone widths 390/320 were checked without horizontal overflow. Saved previews: `weapons-desktop.png`, `weapons-source-conflict.png`, `weapons-mobile-controls.png`, `weapons-mobile.png`, `weapons-mobile-narrow.png`. The production build passes with the existing bundle-size warning (JS 2.42 MB / 223.55 kB gzip). Full evidence, source issues and commands are in `INCREMENT_10_REPORT.md`.


## Weapon and dungeon cross-references

Exact weapon matching compares the complete, case-sensitive name after outer trim only, using main records exclusively. It preserves original reward text, punctuation, internal spaces and Unicode. A duplicate canonical match suppresses navigation. The pure utility computes 14 exact occurrences for 13 weapons, 12 refined-label candidates, zero ambiguous matches and 150 other unmatched documented occurrences; four dash phase fields are ignored. Candidates preserve the full terminal +N label and suggest a base without linking internally or calculating refined statistics.

Dungeon reward cells offer View weapon only for an exact match. The existing weapon panel opens/focuses with origin dungeon/chest/phase/source context. Documented Dungeon Sources lists every exact acquisition occurrence and returns to the specific focused chest/phase. Salamander retains both Palace of Sand Part III and Southern Passage Part I. No exact source is explicitly distinguished from unavailability. Filter values and main/A/B/preset state remain unchanged. Out-of-filter details remain visible; an excluded navigation phase temporarily shows both phases with an explanation. Existing scroll navigation clears a previous chest target and still focuses the location heading.

No weapon equip, inventory, ownership, acquisition tracking, legality, combat calculation or preset fields were added. Source JSON and workbook hashes remain unchanged. Desktop, 390px and 320px views have no horizontal overflow; clean-load console check passed. Full occurrence/unmatched audits, screenshots, test-command caveats and launch instructions are in `INCREMENT_11_REPORT.md`.

## Session ability planning

Open **Proficiency Progression**, browse a character's recorded unlocks and use **Add to shortlist**. Open **Ability Planning Shortlist** to inspect eight planning slots, move entries with Up/Down, remove one or clear the selected character's list after confirmation. Changing class retains plans. Switching characters shows an independent list and retains the previous one during this page session. Refresh clears all plans. Existing named BuildPresets still save only character/class identifiers; no shortlist fields or migration were added.

App owns a reducer with `byCharacter` lists. Stable identifiers encode the exact selected profile, proficiency, rank and original source-cell reference, never the ability name or display position. Duplicate source paths are blocked; identical names on distinct documented paths are allowed. Mu's alternate profile reuses the explicit Mu learnset mapping but has a separate state key and growth profile. Neither browser storage nor URL state is used for plans.

All 4,284 source rank records remain unchanged: 2,321 documented/unverified, 1,871 unknown, 56 explicit N/A, 27 compound and nine placeholder. Only identifiable single documented entries have Add actions. Blank, N/A, bare `?`, `Airfighter?` and unsplit compounds remain available in the progression browser. The shortlist retains original text, rank, source links, evidence and available glossary descriptions/caveats; missing effects say **Effect not yet documented.** The summary counts source paths and lists exact ranks; it calculates no training time, proficiency XP, equip legality, slot cost or ability effects.

## Shortlist source navigation

Use **View in Proficiency Progression** on a planned entry to open its exact proficiency/rank/source path. The existing source ID, not its ability name, selects the destination. The original rank row is revealed once in source order, with keyboard focus and a labeled outline lasting six seconds. Repeating the action restarts that highlight; inspection updates to the chosen record and its available glossary evidence. Scrolling is instant, including for reduced-motion users.

Search and rank-filter values remain unchanged. A hidden target is temporarily included with an explicit explanation. **Return to filtered results**, editing search/rank filters or choosing a category ends this reveal. The highlight expires independently; a hidden target stays available for reading until the reveal is ended. Character switching clears the arrival without replaying an old request or changing character automatically. Mu's existing mapped source and distinct selected profile are both retained. Missing/stale source targets show a nonfatal message and leave plans unchanged. No routing, storage, schema, dependency or calculation changes were introduced.

After source navigation, **Return to Shortlist** reopens the existing shortlist panel and focuses the originating card by the same profile/source ID. Reordering never changes that destination. A labeled outline lasts six seconds; focus/scroll happen after rendering without delay timers or animation. Search/rank changes retain the origin; manually inspecting a different record or switching character discards it. A successful return consumes the origin, while the source inspection and filters stay intact. A new View action starts another round trip.

If a planned entry was removed, cleared or its original source became stale, the active return action is replaced with an error and **Open Shortlist Panel**. That fallback focuses the selected profile's heading and states that no entry was restored. No return state is stored in browser storage, URLs or presets. Navigation never changes character automatically or adds a plan.

## Copying a shortlist

Use **Copy Shortlist** in the existing panel to copy the current character's ordered plans. The pure formatter retains exact proficiency/rank, original evidence/reliability, source cells and imported URLs, matrix references and available glossary effects/caveats. Identical names on different paths remain separate. Missing effects/references are never invented. A planning-only disclaimer accompanies every export.

Success appears only after the browser's Clipboard API write resolves. When access fails or the API is absent, a labeled readonly textarea appears with all text selected; **Select shortlist text** selects it again for manual Ctrl+C/device copying. Manual copying is not automatically verified. Empty lists disable copying; switching profiles immediately uses their independent records and clears stale feedback. Both Mu profiles retain distinct names and lists. Only local feedback changes; no storage, preset schema, ordering or build calculation changes were made. Refresh still clears plans.

Increment 15 verification: **122 Python + 290 frontend = 412 passing tests**, TypeScript and production build passed. Normal-app desktop 1366×900 and phones 390×900/320×900 have no horizontal overflow; keyboard Enter/Space and a separate real-app clipboard-denial preview were checked. Real refresh reset the shortlist while all three preset contents/dates remained identical. No browser console warnings/errors were found. OS clipboard readback was not independently verified because automation exposes a separate virtual clipboard; tests verify the exact write argument and deferred success. Production JS is 2,441.97 kB / 230.86 kB gzip, retaining the nonfatal bundle-size warning. See `INCREMENT_15_REPORT.md`, `shortlist-copy-example.txt` and `shortlist-copy-*.jpg`.

## Downloading a shortlist

Use **Download .txt** beside Copy for the current character's plans. It receives the exact same `text` from `formatShortlistText`; it adds no BOM, extra newline or alternative formatting. Filenames are sanitized, capped at 80 Unicode code points before the fixed suffix and protected against empty/device names. Mu uses `mu-ability-shortlist.txt`; the alternative profile uses `mu-with-growth-ability-shortlist.txt`.

The browser helper creates a UTF-8 `text/plain;charset=utf-8` Blob and object URL, clicks a hidden temporary download anchor, removes the anchor and revokes the URL after one second (immediately on a failed start). No server upload or dependency is involved. Missing APIs or thrown errors use the existing selected readonly fallback. The page cannot verify final storage, browser cancellation or silent blocking; feedback only says **Download started**. The browser chooses the destination and handles duplicate filenames.

Increment 16 verification: **122 Python + 317 frontend = 439 passing tests**, TypeScript and production build passed. The real 1,794-byte Alexandra download exactly equals Increment 15's Copy example. Desktop 1366×900 and 390×900/320×900 phone controls have no horizontal overflow. Keyboard actions, the isolated failure fallback and real refresh reset passed. Named-preset payloads/storage, selectors, filters, navigation and calculations are unchanged in regression tests. Production JS is 2,443.20 kB / 231.36 kB gzip, with the existing nonfatal size warning. See `INCREMENT_16_REPORT.md`, `alexandra-ability-shortlist.txt` and `shortlist-download-*.jpg`.

## Main weapon selection

Open **Selected Weapon** below the main growth planner. Search canonical names, filter by provisional family and choose from the native dropdown; **Clear weapon selection** affects only the current profile. An out-of-filter current choice remains inspectable. Every canonical weapon is available regardless of class support or missing source fields. The separate reference catalog remains independent.

Class context compares provisional family with the original `Classes!L` list only. Explicit singular/plural aliases are supported for all five families. Listed, not listed and unresolved outcomes never enforce equip legality or infer a current rank from XP, learnsets or examination prerequisites. All original allowed-type qualifications remain visible. Weapon properties use the existing importer/model, preserving zeros, missing values, Might endpoints and source discrepancies. Exact dungeon buttons use the existing phase-cell navigation; refined-label candidates remain unverified and noninteractive.

App keeps a separate canonical weapon ID per main character in React memory, including separate Mu profiles. Changing class retains the weapon. Loading a main preset changes character/class and reveals that character's session choice. Build A/B, named-preset payloads, ability shortlists and calculations are unchanged. Refresh clears weapon choices; weapons are not saved in presets.

The source has no explicit family column. `scripts/import_weapon_families.py` reads the unchanged workbook through the existing Forging importer and writes only `src/data/weapon-families.json`: Sword rows 19–38 (20), Spear 39–60 (22), Axe 61–79 (19), Bow 80–94 (15), Gauntlets 95–109 (15). Each record includes provisional status, source cell/section and ambiguity field. The command validates workbook/snapshot identity, counts, row continuity and boundary anchors. It never guesses from names or includes preliminary contributions. Reconcile a deliberate source refresh with the main importer first, then run:

```powershell
python -X utf8 scripts/import_weapon_families.py
```

Stale/moved/missing family evidence produces unresolved compatibility. No family is independently confirmed, no intermediate refinement or combat value is calculated, and no inventory, ownership or full-loadout system is added. The original workbook, main JSON and import report remain byte-for-byte unchanged. See `INCREMENT_17_REPORT.md` and `selected-weapon-*.jpg` for verification and previews.

Increment 17 verification: **130 Python + 365 frontend = 495 tests passed**, preserving all 439 prior cases and assertions. Desktop 1366×900, phone 390×900/320×900, exact dungeon navigation, incomplete records, separate Mu profiles and actual refresh reset were checked. The main weapon slot never changes the nine growth outputs, comparison builds, saved-preset payloads or ability plans. Tests use the unchanged single-worker command with a documented 15-second timing allowance; the original five-second budget was also exceeded by the pre-increment App on this host. Runtime, parsing and data were not changed to bypass these checks.


## Full build loadouts and backups

Full Build Loadouts uses the separate version-1 `fortunes-weave.full-loadouts` browser key. Explicit Save, Load, Rename, Duplicate and confirmed Delete actions do not migrate or overwrite the existing character/class presets. Loading validates every current source ID first; unresolved references block the complete operation. Save errors, malformed storage and stale-tab edits preserve existing stored data. Local saves belong to one browser and app address; unsaved choices remain session-only.

Download loadout backup exports validated UTF-8 JSON through the shared download helper. Choose a local JSON file to preview additions, identical skips and ID/name conflicts, then explicitly confirm an add-only import. Files above 5 MiB are rejected. No upload/server is involved. A browser download failure offers selected manual-copy JSON. “Download started” does not promise final disk storage. Export a backup before moving browsers, changing the app address or clearing browser data.

Saved cards render on first opening, with 25 per page and a search across the complete collection. Filtering never truncates backups or comparison choices. The import preview displays the first 25 new names while confirming all additions. Comparison’s numeric columns remain character + class growth; equipment/source evidence appears separately.

## Documented mount growth preview

The preview is separate from the original nine growth cards and all existing TXT exports. It follows the workbook’s species condition and compatible-mount Charioteer ×2 formula. Only recorded numeric modifiers are added. Blank modifiers produce unavailable totals; disputed written/numeric records select neither version. An incompatible or unmounted class follows the workbook’s explicit zero-contribution branch, without replacing raw blank values. Flat statistics, ownership, acquisition, legality and combat effects are excluded. The rule sidecar remains labeled unverified workbook evidence.

`scripts/import_mount_growth_rules.py` validates 30 formulas against the same workbook hash as the imported snapshot. String literals are preserved during validation; unsupported formulas are rejected. Its output cannot overwrite the source workbook or source JSON and is published after validation. `--check` reads without rewriting anything.

## Runtime data generation and verification

`src/data/growths.json` remains the authoritative importer output. `pnpm pack:data` produces an encoded audit artifact and four derived runtime parts under `src/data/runtime/`. One shared codec/assembler reconstructs all fields, array/key order, Unicode, blanks, zeroes, negative values and source URLs exactly. Source hash metadata prevents mixed snapshots. `pnpm check:data` and the build fail on stale or missing generated artifacts; they do not silently regenerate data.

The runtime parts contain reference data and three groups of four proficiency categories. They remain synchronous static imports, served from the local app with no external API. Vite independently caches their hashed modules. The largest JavaScript file is about 390 kB, below the unchanged default warning threshold. Splitting adds four static data modules and slightly increases gzip size versus the single packed artifact; aggregate delivery is still smaller than the pre-optimization build. The benchmark is a Node parse/decode measurement, not a browser startup or heap claim.

After a deliberate source refresh, run the complete reviewed import sequence above, including the family/rule sidecars and `pnpm pack:data`. Formula or section-boundary changes require review, not guessed corrections. For ordinary app use, no reimport is needed. To check existing artifacts without writes:

```powershell
python scripts/import_mount_growth_rules.py --check
pnpm check:data
pnpm test:data
node scripts/benchmark_runtime_data.mjs
```
