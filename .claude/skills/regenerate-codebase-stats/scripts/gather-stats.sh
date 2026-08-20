#!/usr/bin/env bash
#
# Compute the codebase-evolution figures for codebase-evolution-stats.html.
#
# Counting rules (must match the methodology the dashboard was built with):
#   - cloc, counting CODE lines only (blanks and comments reported separately)
#   - git-tracked files ONLY (so build output, dist/, target/, node_modules are out)
#   - server/ts-gen/ is excluded everywhere: it is GENERATED TypeScript, not hand-written
#   - Serenity (server/lib/serenity-js/) is its own component, split out of the server total
#   - ekwg (750) and ng-ekwg (435) commit totals are FIXED history from archived repos
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

command -v cloc >/dev/null || { echo "cloc not installed (brew install cloc)" >&2; exit 1; }

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

git ls-files '*.ts'                              | grep -v '^server/ts-gen/'                                      > "$tmp/all_ts.txt"
git ls-files 'projects/*.ts' 'projects/**/*.ts'                                                                  > "$tmp/client_ts.txt"
git ls-files 'server/*.ts' 'server/**/*.ts'      | grep -v '^server/ts-gen/' | grep -v '^server/lib/serenity-js/' > "$tmp/server_ts.txt"
git ls-files 'server/lib/serenity-js/**/*.ts'                                                                    > "$tmp/serenity_ts.txt"
git ls-files                                      | grep -v '^server/ts-gen/'                                      > "$tmp/all_tracked.txt"

# Print "files code comment" for the TypeScript row of a cloc run over a file list.
ts_row() { cloc --quiet --csv --timeout 0 --list-file="$1" 2>/dev/null | awk -F, '$2=="TypeScript"{print $1" "$5" "$4}'; }

read -r CLIENT_FILES   CLIENT_LOC   _              < <(ts_row "$tmp/client_ts.txt")
read -r SERVER_FILES   SERVER_LOC   SERVER_CMT     < <(ts_row "$tmp/server_ts.txt")
read -r SEREN_FILES    SEREN_LOC    _              < <(ts_row "$tmp/serenity_ts.txt")

TOTAL_LOC=$((CLIENT_LOC + SERVER_LOC + SEREN_LOC))
TOTAL_FILES=$((CLIENT_FILES + SERVER_FILES + SEREN_FILES))

# Language breakdown over everything tracked (excl. ts-gen). Buckets mirror the doughnut:
#   Sass = Sass + SCSS ; HTML = HTML ; Other = SVG + shells + Dockerfile + TOML + INI
#   (JSON / Markdown / CSV / YAML are data/config and are intentionally excluded)
LANG_CSV=$(cloc --quiet --csv --timeout 0 --list-file="$tmp/all_tracked.txt" 2>/dev/null)
SASS_LOC=$(echo "$LANG_CSV" | awk -F, '$2=="Sass"||$2=="SCSS"{s+=$5} END{print s+0}')
HTML_LOC=$(echo "$LANG_CSV" | awk -F, '$2=="HTML"{print $5+0}')
OTHER_LOC=$(echo "$LANG_CSV" | awk -F, '$2~/^(SVG|Bourne Shell|Bourne Again Shell|Dockerfile|TOML|INI)$/{s+=$5} END{print s+0}')
TS_COMMENTS=$(echo "$LANG_CSV" | awk -F, '$2=="TypeScript"{print $4+0}')

NGX_COMMITS=$(git rev-list --count HEAD)
EKWG=750; NG_EKWG=435
TOTAL_COMMITS=$((EKWG + NG_EKWG + NGX_COMMITS))
THIS_YEAR=$(git log -1 --date=format:'%Y' --pretty='%ad')
YEAR_COMMITS=$(git log --date=format:'%Y' --pretty='%ad' | grep -c "^${THIS_YEAR}$")

echo "=================================================================="
echo " codebase-evolution-stats.html  —  regenerated figures"
echo " snapshot date: $(git log -1 --date=format:'%-d %B %Y' --pretty='%ad')"
echo "=================================================================="
echo
echo "HERO CARDS"
printf "  Lines of Code ......... %'d   (label below: same number + LOC)\n" "$TOTAL_LOC"
printf "  Total Commits ......... %'d   (ekwg %d + ng-ekwg %d + ngx-ramblers %d)\n" "$TOTAL_COMMITS" "$EKWG" "$NG_EKWG" "$NGX_COMMITS"
printf "  TypeScript Files ...... %'d\n" "$TOTAL_FILES"
echo
echo "COMPONENT SPLIT (growth chart final point, component doughnut)"
printf "  Client ................ %'d  (%d files)\n" "$CLIENT_LOC" "$CLIENT_FILES"
printf "  Server (excl Serenity)  %'d  (%d files)\n" "$SERVER_LOC" "$SERVER_FILES"
printf "  Serenity E2E .......... %'d  (%d files)\n" "$SEREN_LOC" "$SEREN_FILES"
echo
echo "LANGUAGE DOUGHNUT"
printf "  TypeScript ............ %'d\n" "$TOTAL_LOC"
printf "  Sass (Sass+SCSS) ...... %'d\n" "$SASS_LOC"
printf "  HTML .................. %'d\n" "$HTML_LOC"
printf "  Other (svg/sh/docker) . %'d\n" "$OTHER_LOC"
echo
echo "REPO JOURNEY + TIMELINE + INSIGHTS"
printf "  ngx-ramblers commits .. %d\n" "$NGX_COMMITS"
printf "  commits this year (%s) %s\n" "$THIS_YEAR" "$YEAR_COMMITS"
printf "  TS comments (clean-code insight) .. %d\n" "$TS_COMMENTS"
echo
echo "COMMITS BY YEAR (ngx-ramblers — feeds the commit-activity bar chart)"
git log --date=format:'%Y' --pretty='%ad' | sort | uniq -c | awk '{printf "  %s: %s\n", $2, $1}'
echo
echo "Note: ekwg & ng-ekwg per-year bars are fixed history — do not recompute."
