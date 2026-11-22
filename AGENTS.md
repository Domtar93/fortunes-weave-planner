# Working on the Fortune's Weave Build Planner

React 19 + TypeScript + Vite 6, tested with Vitest (jsdom), Node's test runner and Python unittest. Windows, PowerShell. This folder is not a git repository. A backup is at `..\fortune-weave-planner-backup-2026-11-21`; do not edit or delete it.

## Tools are not on the default PATH

Node, pnpm and the project's Python live in a runtime folder. Put them on PATH at the start of every PowerShell command that needs them:

```powershell
$d="$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies"; $env:Path="$d\node\bin;$d\bin\fallback;$d\python;$env:Path"
```

That gives node 24, pnpm 11 and Python 3.12 with openpyxl already installed. Do not install Node, pnpm, Python or packages globally, and do not run `pnpm install` unless `node_modules` is missing.

If `pnpm` fails with `Cannot find module ...\node\node_modules\pnpm\bin\pnpm.mjs` (seen November 22, 2026: the runtime's pnpm package is missing), call the tools through node instead, with `$n="$d\node\bin\node.exe"`:
- Build: `& $n scripts/pack_runtime_data.mjs --check; & $n scripts/pack_community_data.mjs --check; & $n scripts/pack_ability_info.mjs --check; & $n node_modules/typescript/bin/tsc -b; & $n node_modules/vite/bin/vite.js build`
- Tests: `& $n node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --testTimeout=180000`

## Running checks

- Build: `pnpm build` (data `--check` scripts, then `tsc -b`, then `vite build`).
- Unit and UI tests: **do not use plain `pnpm test`.** This machine is under heavy CPU load, and the default 15s timeout produces false timeouts. Use:
  `pnpm exec vitest run --maxWorkers=1 --minWorkers=1 --testTimeout=180000`
  The full suite takes 10 to 18 minutes; run it in the background or with a long timeout. While iterating, run only the files you touched: `pnpm exec vitest run src/Foo.test.tsx --testTimeout=180000`.
- Data artifacts: `pnpm test:data`.
- Import tests: `pnpm test:import` (needs the PATH line above so `python` is the runtime Python).

A timeout is not a real failure. Rerun that file alone with the long timeout before changing anything. Never raise or lower timeouts in `vite.config.ts`, and never weaken, skip or delete a test to make a run pass.

## Rules that always apply

- `data/source.xlsx` is read-only. Never modify, regenerate or reformat it.
- `work/` now holds only `test-fixtures/` and `test-temp/`, scratch folders the importer tests write into; keep the folder. Old reports, screenshots and the earlier `work/` history were moved to `..\fortune-weave-planner-archive` (November 22, 2026); never edit or delete the archive.
- Do not change saved-build or preset schemas, localStorage keys (including `fortunes-weave.full-loadouts`, version 1), backup/import JSON, or the text of copied or downloaded exports. Saved user data must keep loading.
- Player checkpoint and actual-stat observations stay session-only. Never persist them.
- Never invent a stat, growth rate, count or percentage. Unknown or disputed values stay marked as unknown or disputed. Never mix growth percentages with flat stat points.
- Easy-to-read results come first. Source details can sit behind a `<details>`, but a conflict between sources must never be hidden.
- Do not rename the tab labels or ids in `src/App.tsx` (Build, Abilities, Compare & saves, Reference); tests match them.
- Existing tests count exactly 9 `article` elements in the app (the Build tab stat tiles). Do not add new `<article>` elements; use `div role="group"` or a `section` instead.
- Windows file names are case-insensitive: never create two files whose names differ only by case.
- Layouts must work at 390px and 320px wide with no horizontal scrolling.
- Do not modify Guardian Tactics or any project outside this folder.
