# Fortune’s Weave Build Planner

An unofficial, fan-made build planner for Fortune’s Weave. Pick a character, a class and a level to see average stats right away, then plan abilities and gear, compare pairings and save complete builds. Its calculations use bundled community research and published source snapshots. When the research is incomplete or disputed, the planner says so rather than guessing. It runs entirely in your browser: no account, no server, no tracking, and your saves stay on your own machine.

## What’s inside

The planner has four tabs.

### Build

- Choose any of the 64 character profiles and 59 classes, set a level, and see all nine stats as average totals for that level. A character you haven’t set a level for opens at the last level you chose, so switching characters compares them at the same point.
- **Class path** handles class changes along the way: add up to four earlier classes, each held until a level you choose, before your main class. Each class’s growth applies to its own level-ups, and the averages and charts follow the path. It lasts for the current session and is included in share links.
- **Copy share link** puts the whole build (character, class, level, equipment and ability plan) into a link. Opening the link loads that build; nothing is saved until you choose to save it.
- **Stats by level** draws each stat from the starting level to 99, with the “Compare with” class as a dashed second line. Hover or tap to read any level; a table view is included.
- **Find a character** filters all 64 characters by growth rate (for example Speed ≥ 50% and Magic ≥ 40%), using their own growth or growth with the current class. Characters with no recorded rate are listed as unknown, not dropped.
- **Find the best class** and **Suggested builds** rank all 59 classes for the current character by any stat.
- **Expected Growth** breaks each growth rate into its personal + class = combined parts. Growth percentages and flat stat points are always kept apart.
- Optionally enter stats from your own playthrough to compare them with the expected values. These observations last only for the current session and are never saved.
- Pick a weapon, battalion and mount for the character. Mounted classes get a quick mount picker and a separate, clearly labelled preview of documented mount growth.
- Character notes (personal abilities, recruitment routes), collapsible class details, and a Main Build Overview you can copy or download as plain text.

### Abilities

- Browse every rank unlock a character has in each proficiency, with filters for documented and unknown entries and a name search.
- Read ability effects where the research has them. Where it doesn’t, the planner says “not yet documented”.
- Add abilities to a per-character plan, reorder it, jump between the plan and the source rank, and copy or download the plan as text.

### Compare & saves

- **Full Build Loadouts** saves the whole plan (character, class, equipment and ordered abilities) under a name you choose. You can load, rename, duplicate or delete saves, and search them.
- **My Character Builds** stores lighter character + class presets and loads them into the main planner or either comparison slot.
- **Build comparison** puts two character/class pairings side by side, stat by stat, showing the difference in percentage points. It doesn’t give an overall “best build” ranking.

### Reference

- Searchable catalogs for mounts, battalions, magic scrolls, dungeon chests and rewards, and weapons and forging.
- Links between related entries, such as a weapon and the dungeon chest it comes from.
- The community research sheets, plus workbook notes that list unresolved discrepancies.

## Saving, backups and exports

- **Saving** uses your browser’s local storage. Saves belong to this browser and this app address. A different browser, a private window or clearing site data won’t see them.
- **Backup and import:** download your full loadouts as a JSON backup file. Importing a backup shows a preview first, only adds new loadouts, and never silently overwrites existing ones. Make a backup before switching browsers or clearing browser data.
- **Exports:** the build overview and ability plans can be copied to the clipboard or downloaded as `.txt` files to paste into a post or keep as notes. If the clipboard is blocked, the text is shown so you can copy it by hand.
- **Share links** carry the build in the part of the address after `#`, which browsers don’t send to the server. Opening one never changes your saved builds.
- **Offline:** after the first visit to the published site, the planner keeps working without a connection (each full community research sheet works offline once you’ve opened it), and you can install it as an app from the browser menu.
- Unsaved choices reset when you refresh the page. Nothing is uploaded anywhere.

## Data sources and limits

- **Sources:** growth and reference data come from the community research workbook, bundled read-only as [`data/source.xlsx`](data/source.xlsx), and a separate additional community snapshot. Published starting stats and reviewed ability descriptions have their own sources, documented in the [average-stats report](docs/AVERAGE_STATS_FIX_REPORT.md) and [ability-research report](docs/ABILITY_RESEARCH_REPORT.md). Import scripts turn the source snapshots into the JSON the app uses. The app never edits the workbook.
- **No invented stats:** missing values stay unknown unless a documented workbook rule explicitly supplies an interpretation, such as zero Commoner / Noble modifiers or labelled blank-as-zero mount previews. Raw blanks are preserved, and nothing is filled in by guesswork.
- **Disputes stay visible:** when sources disagree, both versions are shown and the entry is marked as disputed. Detailed source notes sit behind expandable sections, but a conflict is never hidden.
- **Reference-only variants:** the 64 original character profiles and 59 classes make up the planning set. Extra variants, NPCs and datamined entries from the additional community sheet appear in Reference only and can’t be selected for builds.
- **Not modelled:** certification odds, equip legality, combat damage, equipment stat totals and build optimisation. These aren’t established by the sources, so the planner doesn’t calculate them.
- Most community entries are unverified. If you can confirm or correct something, a source-backed report is the most helpful contribution: use **Report a correction** in the page footer, or open a “Data correction” issue.

## Publishing on GitHub Pages

The repository includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds and publishes the planner on every push to `main`.

1. Create a GitHub repository and push this folder to its `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push again (or run the workflow from the **Actions** tab). The site appears at `https://<user>.github.io/<repository>/`.

The workflow sets `VITE_SITE_URL` (so the social preview image has an absolute address) and `VITE_REPO_URL` (which turns on the footer’s **Report a correction** link). Local builds use `./` from [`.env`](.env) and hide that link. The build uses relative paths, so it works at any address.

## Quick start

You need [Node.js](https://nodejs.org/) 22 or newer and [pnpm](https://pnpm.io/) 11.

```sh
pnpm install
pnpm dev        # local dev server at http://127.0.0.1:5173
pnpm build      # data checks, type check and production build into dist/
pnpm preview    # serve the production build locally
pnpm test       # unit and UI tests (Vitest)
```

On a slow or busy machine, run the tests on a single worker with a longer timeout:

```sh
pnpm exec vitest run --maxWorkers=1 --minWorkers=1 --testTimeout=180000
```

The data importers and their tests need Python 3.10 or newer, plus the packages in [`requirements.txt`](requirements.txt). You only need these to check or regenerate data, not to use the app.

```sh
python -m pip install -r requirements.txt
pnpm test:import   # Python importer tests
pnpm test:data     # Node checks for the generated runtime data
```

## Project layout

```text
data/          Read-only source workbook, base-stat and community snapshots, import report
scripts/       Python importers and Node scripts that pack and check the runtime data
src/           React + TypeScript app (components, models and their tests)
src/data/      Generated JSON the app loads at runtime
public/        App icons, web manifest and the social preview image
tests/         Python unittest suites for the importers
docs/          Project history, data-source reports and the reference refresh guide
```

[`docs/HISTORY.md`](docs/HISTORY.md) is the full changelog, including importer internals, validation rules and the reasoning behind each data decision. [`docs/AVERAGE_STATS_FIX_REPORT.md`](docs/AVERAGE_STATS_FIX_REPORT.md) and [`docs/ABILITY_RESEARCH_REPORT.md`](docs/ABILITY_RESEARCH_REPORT.md) document where the starting stats and ability descriptions come from.

## License

The planner’s code is available under the [MIT License](LICENSE). The license covers the code only. The game data, community research and character portraits belong to their respective owners (see below).

## Credits and disclaimer

Credit for the game data goes to the community researchers who built and maintain the Fortune’s Weave research workbook and the additional community sheet. This planner just organises their work.

Character portraits are official art © Nintendo / Intelligent Systems, taken from the [Fire Emblem Wiki](https://fireemblem.fandom.com/) and resized for this planner. Eshmel, the customisable protagonist, has no standard portrait and shows initials.

This is an unofficial fan tool. It isn’t affiliated with or endorsed by the developers or publishers of Fortune’s Weave. All game names and related trademarks belong to their respective owners. Values come from community research and may be incomplete or wrong, so double-check anything important in the game itself.
