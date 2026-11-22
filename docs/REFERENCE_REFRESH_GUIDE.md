# Reference refresh and recovery guide

This workflow concerns the **additional community sheet**, whose source references include a snapshot identity. It does not migrate the original workbook, presets, game mechanics or inventory ownership. No source refresh was performed for the audit-improvements release; existing source namespaces and saved references remain valid.

## Before any future source refresh

1. Explicitly save any Main choices you want to preserve in **Full Build Loadouts**. Unsaved choices remain session-only and are excluded from backups.
2. Under **Back up or import full loadouts**, download the normal JSON backup. Keep it unchanged.
3. Under **Reference refresh & recovery**, download the **reference recovery backup**. This includes the full saved collection and exact current community unlock names/source links needed for a later comparison. A normal backup alone contains source addresses, not historical unlock names.
4. Preserve the current app release and captured source snapshot. Keep the normal and reference-recovery files outside the app folder that will be updated. Browser feedback says download started; confirm the files exist yourself.

If the recovery action says some community references are already stale, it will not fabricate their old names. Keep the normal backup. Export recovery evidence from a preserved release that can still resolve those sources. If that older release predates the recovery action, use a separate copy of the current code with the archived snapshot, reimport/repack it, serve on an isolated local port, import the normal backup there, and export recovery evidence. Keep the working app and original backups intact. If the old snapshot is unavailable, affected choices must be rebuilt manually.

## Review and publish the new captured reference

This is a maintainer action, not a runtime upload or automatic refresh. Preserve the original corrected Excel workbook and source JSON. Capture the complete additional-sheet API snapshot as a separate file and inspect its diff, source issues, profiles, ranks and fields before replacing the companion input `data/community/source.snapshot.json`.

The importer refuses a changed snapshot by default **before writing generated artifacts**. After the diff and recovery backups are reviewed, explicitly acknowledge the refresh:

```powershell
python scripts/import_community_reference.py --accept-source-refresh
pnpm pack:community
pnpm check:community
pnpm test --maxWorkers=1
python -m unittest discover -s tests -v
pnpm test:data
pnpm build
```

Without a snapshot change, `pnpm import:community` and `pnpm pack:community` regenerate current derived files normally. `pnpm check:community` remains read-only. All source schemas, 64 personal growth controls, exact generated-sheet hashes and runtime equality must pass. The acceptance flag does not bypass those validations. Retain the reviewed old release and the new source diff.

## Recover after a source change

1. Open **Full Build Loadouts → Reference refresh & recovery** and choose the previously exported recovery JSON. Reading the file changes no saves or Main choices.
2. Choose one saved loadout to review. Each community ability maps only by the same character profile/learnset identity, proficiency and exact rank. Old/new names, source paths and links appear together in their original order. Both Mu profiles stay separate.
3. Same text with a new snapshot produces a source-update proposal. Different text requires its own approval checkbox. Unknown, unavailable, placeholder, compound, missing, ambiguous or duplicate targets block creation. Removed equipment or other unresolved build references also block it. No entry is silently removed or substituted.
4. Choose a unique copy name and explicitly click **Create recovered copy**. This appends a newly identified local save; the original saved record is retained and Main is not loaded or changed. Storage errors and concurrent changes block the write. Read storage again before retrying after another tab changed it.
5. Repeat for other plans, inspect/load the copies explicitly, then export a fresh normal backup and reference-recovery backup. Keep the original files until satisfied. Existing original-workbook source paths are retained and validated; historical text for those paths is not claimed or invented by the community recovery file.

Recovery JSON is user-supplied, unverified evidence, not independent verification of game mechanics. Malformed schemas, unsafe source URLs, missing/unrelated/duplicate evidence and files larger than 5 MiB are rejected. A future unsupported file version requires a compatible app. All actions stay local; no server upload or automatic save migration occurs.
