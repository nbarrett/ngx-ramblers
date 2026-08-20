---
name: regenerate-codebase-stats
description: Refresh the figures in codebase-evolution-stats.html (the NGX-Ramblers Codebase Evolution dashboard at the repo root). Use whenever the user asks to regenerate, refresh, update, or re-run the codebase stats / evolution stats / code-based evaluation stats, or says the LOC / commit / file-count numbers on that page are stale. Handles the exact cloc counting rules, the client/server/Serenity split, the number-to-chart mapping, and the GitHub Pages publishing step.
---

# Regenerate codebase-evolution stats

`codebase-evolution-stats.html` at the repo root is a static dashboard with **hardcoded** numbers (hero cards, Chart.js datasets, timeline, key-insight cards). Nothing computes them at view time, so "regenerate the stats" means: recompute the real figures from the current repo, then hand-edit them into the HTML.

## 1. Compute the figures

Run the bundled script from anywhere in the repo:

```bash
bash .claude/skills/regenerate-codebase-stats/scripts/gather-stats.sh
```

It prints every number the dashboard needs, already grouped by where it goes. Do not eyeball LOC by hand — the counting rules below are easy to get wrong and the script encodes them.

### Counting rules (why the script is the authority)

- **cloc, code lines only.** Blanks and comments are reported separately. This matches how the dashboard was originally built (the "clean code" insight quotes the comment count).
- **git-tracked files only.** Keeps `dist/`, `server/target/`, report caches and `node_modules` out without fragile path excludes.
- **`server/ts-gen/` is excluded everywhere.** It is *generated* TypeScript (700+ files). Counting it roughly doubles the server total and is wrong. This is the single biggest trap.
- **Serenity is its own component.** It lives in `server/lib/serenity-js/` (not in `e2e/` — that dir only holds a tsconfig). The dashboard shows it as a separate "Serenity E2E" slice, so the script splits it out of the server total. Serenity is stable at ~1,960 LOC; if it has "changed" a lot, you have probably mis-scoped the server count.
- **ekwg (750) and ng-ekwg (435) are fixed history.** Those repos are archived. Their commit totals and per-year bars never change — only ngx-ramblers moves.

## 2. Map figures into the HTML

Edit `codebase-evolution-stats.html`. Each figure appears in more than one place; update all of them so the page stays internally consistent (the component LOC must sum to the hero LOC).

| Script line | Where in the HTML |
|---|---|
| Lines of Code | hero card `stat-value highlight`; the `stat-detail` under TypeScript Files; `Total LOC` final datapoint in `growthChart`; modern bucket in `techEvolutionChart`; timeline top-item badge; "13-Year Journey" + growth insight cards |
| Total Commits | hero "Total Commits" card; "N Commits" insight card |
| TypeScript Files | hero "TypeScript Files" card |
| Client | `growthChart` Client final point; `componentChart` data[0] + its `Client (NNNK)` label |
| Server (excl Serenity) | `growthChart` Server final point; `componentChart` data[1] + label; `serverEvolutionChart` final TypeScript point |
| Serenity E2E | `componentChart` data[2] + label |
| Sass / HTML / Other | `languageChart` data + labels (TypeScript is the LOC total) |
| ngx-ramblers commits | Repository Journey `ngx-ramblers` card commits |
| current LOC (rounded) | Repository Journey `ngx-ramblers` card "Current LOC" (e.g. `220K`) |
| commits this year | timeline top item + "N Commits" insight |
| commits by year | `commitsChart` `ngx-ramblers (Modern)` dataset — append/replace the latest year |
| TS comments | "Clean Code Philosophy" insight card |
| snapshot date | hero card `stat-detail` (e.g. "June 2026") and the footer "Snapshot generated ..." line |

Also refresh the **chart axis labels** when the month rolls over (e.g. `'May 2026'` → `'Jun 2026'` in `growthChart` and `serverEvolutionChart`), and rewrite the **timeline top item** and any **insight percentages** so the prose matches the new numbers (growth % is measured from the Jul 2024 baseline of 57,974 LOC; server growth from 6,122).

Label rounding: big numbers in chart labels are rounded to `K` (219,685 → "220K", 145,552 → "146K"); the underlying `data: [...]` value stays exact.

## 3. Verify

The page is plain HTML + Chart.js from a CDN. Open the file in a browser; do not start a new dev server. Sanity checks: component LOC sums to the hero LOC, no chart shows a flat/empty final bar, and the mobile view (header, 2-column stat grid) still looks right at ~380px.

## 4. Publishing

This is GitHub Pages from the `main` branch root, so `codebase-evolution-stats.html` is served from the repository's Pages URL. Publishing means committing the file and pushing to `main` when the user asks. Do not commit or push without explicit instruction.
