# Shai-Hulud Supply Chain Check

CLI to scan lockfiles for Shai-Hulud 2.0 indicators, high/critical npm/pnpm audit issues, and suspicious persistence files.

## Usage (inside this repo)
- Default (repo root):  
  `npm run --prefix server check:shai-hulud`
- Scan another folder (e.g., frontend):  
  `npm run --prefix server check:shai-hulud -- --path ..`
- Positional target instead of `--path`:  
  `npm run --prefix server check:shai-hulud -- ..`
- Force lockfile name (rare):  
  `npm run --prefix server check:shai-hulud -- --lockfile pnpm-lock.yaml`
- Skip audit step:  
  `npm run --prefix server check:shai-hulud -- --skip-audit`
- Help:  
  `npm run --prefix server check:shai-hulud -- -h`

## Usage on another repo (without installing deps there)
- From this repo, pointing at another project:  
  `npm run --prefix server check:shai-hulud -- --path /path/to/other-repo`

## Usage as a standalone one-off (no local install in target)
- Use `npx` to pull runtime deps on the fly (requires network):  
  `npx --yes --package=tsx --package=commander --package=debug --package=semver --package=js-yaml tsx /absolute/path/to/check-shai-hulud.ts --path /path/to/other-repo`

## Exit behavior
- Exits non-zero when compromised packages, high/critical audit issues, or suspicious files are found.
- Shows recommendations tailored to findings; clean runs exit 0 with no recommendations.
