# Developing NGX-Ramblers with an AI coding agent

A getting-started guide for contributors who want to work on NGX-Ramblers using an
AI coding agent (Claude Code, Codex, or similar). It covers the tooling, how to run
the full stack locally against a single group's data, and the conventions a change
has to follow before it can be accepted.

For the marketing overview of the project, see [README.md](../../README.md). For the
binding rules an agent must follow while editing this codebase, see
[AGENTS.md](../../AGENTS.md) — read that file before writing any code.

## What "agentic development" means here

NGX-Ramblers is one TypeScript codebase, handcrafted over thirteen years, with
hundreds of unit tests and a deliberately disciplined design. An AI agent working
on it is extending a stable, well-tested codebase rather than writing freehand, so
the agent's job is mostly: understand the existing pattern, follow it, stay inside
the rules in [AGENTS.md](../../AGENTS.md).

You do not need to be fluent in TypeScript or Angular to contribute. You do need to
review what the agent produces, run the checks, and understand the change well
enough to stand behind it.

## Prerequisites

- **Node.js** `24.14.0` and **npm** `11.9.0` (the versions CI targets — use a
  version manager such as `nvm` to match exactly)
- **git**
- An **AI coding agent**. Claude Code is the one this guide assumes
- **Google Chrome** — optional, only needed for scraping features

## Getting the code

```
git clone https://github.com/nbarrett/ngx-ramblers.git
cd ngx-ramblers
```

There is no separate install step. The `./bin/ngx-cli` wrapper checks whether
dependencies are present and runs `npm install` for the root and `server/`
projects automatically on first use.

## The rule file: AGENTS.md

[AGENTS.md](../../AGENTS.md) is the file your agent reads to learn how this codebase
expects code to be written. Claude Code picks it up automatically (via
[CLAUDE.md](../../CLAUDE.md)). It covers, among other things:

- Critical rules — never commit or push without being asked, no code comments,
  no AI attribution in commit messages
- ESLint-enforced bans that fail the build (`new Date()`, native `for` loops,
  `Object.keys`, and others — each with the replacement to use)
- Code style — double quotes, `null` over `undefined`, immutable operations
- Git workflow and conventional commit format

If you only read one file before starting, read that one.

## Running the app locally

The NGX CLI runs the whole stack — Angular frontend, Node backend, and the
integration worker — against a single group environment:

```
./bin/ngx-cli local dev <environment> --no-docker-worker
```

`<environment>` is the name of a group (for example `pang-valley`). The CLI starts
the frontend on http://localhost:4200 and the backend on http://localhost:5001,
both with hot reload. `--no-docker-worker` runs the integration worker as a local
Node process rather than a Docker container, so you do not need Docker installed.

Each environment needs three things, and all three are scoped to a single group:

1. **A secrets file** at `non-vcs/secrets/secrets.<app-name>.env`. This holds the
   database connection, file-storage keys, and the other values the app needs to
   run. It is never committed to git.
2. **A local environments manifest** at `non-vcs/secrets/environments.local.json`.
   A small JSON file listing the environments present on your machine, so the CLI
   can resolve `<environment>` to its app without reaching the platform's central
   configuration. It looks like this:

   ```json
   {
     "environments": [
       { "environment": "pang-valley", "flyio": { "appName": "ngx-ramblers-pang-valley" } }
     ]
   }
   ```
3. **A database** for the app to read and write.

As a contributor you are given a self-contained bundle for **your own group only**.
It contains your group's database connection and your group's file storage, and
nothing else — no other group's data, and none of the shared platform credentials
used to deploy or administer the wider service. You can develop, break things, and
reset without any risk to other groups or to the live platform.

To populate a fresh, empty database with sample (non-personal) data so you have
something to work against:

```
./bin/ngx-cli database seed --uri <your-mongodb-uri> --database <name> --group-name "<Your Group>"
```

Other useful CLI commands:

```
./bin/ngx-cli local list          # list environments available to you
./bin/ngx-cli local prod <env>    # build and run in production mode
./bin/ngx-cli --help              # full command list
```

## Repository layout

| Path | What lives there |
|------|------------------|
| `projects/ngx-ramblers/src/app/` | Angular 21 frontend — all components and services |
| `server/` | Node/Express backend (TypeScript only) |
| `server/lib/mongo/` | MongoDB models and controllers |
| `server/lib/brevo/`, `server/lib/ramblers/`, `server/lib/meetup/` | Third-party integrations |
| `server/lib/cli/` | The `ngx-cli` command source |
| `assets/styles/` | Sass tokens, buttons, shared styling |

Interfaces live in model files only — never define them inline in a component or
service.

## A typical change

1. Pick or raise a [GitHub issue](https://github.com/nbarrett/ngx-ramblers/issues)
   describing what you want to change.
2. Ask your agent to make the change. Point it at the issue and let it follow
   [AGENTS.md](../../AGENTS.md).
3. Run the checks:
   ```
   npm run lint          # frontend lint
   npm run lint:server   # backend lint
   npm run test          # frontend tests (Karma + Jasmine)
   npm run test:server   # backend tests (Mocha)
   ```
   `npm run lintfix` auto-fixes what it can.
4. Run the app locally (above) and confirm the change behaves against your own
   group's data.
5. Review the diff yourself before submitting. You are accountable for it, not the
   agent.

## A note on Claude Swarm

The repository includes a Claude Swarm setup (`npm run dev`) for running several
agents in parallel, each in its own git worktree. It has largely been superseded by
running the Claude app natively, which is the path this guide assumes, so you can
ignore Swarm to begin with.

## Submitting your change

The maintainers run a trunk-based workflow and commit straight to `main`; there are
no internal pull requests. As an external contributor you cannot push to `main`, so
the route in is:

- Raise a [GitHub issue](https://github.com/nbarrett/ngx-ramblers/issues) for
  anything non-trivial first, so the approach can be agreed.
- Submit code as a pull request from your fork, or send a patch. A maintainer
  reviews it and integrates it onto `main`.

Set up the git hooks once before committing — they enforce the commit-message and
lint rules locally:

```
npm run setup:hooks
```

## Getting help

- [GitHub issues](https://github.com/nbarrett/ngx-ramblers/issues) — questions,
  bugs, and proposals
- [AGENTS.md](../../AGENTS.md) — the rules
- The [project website](https://ngx-ramblers.org.uk/) — the how-to documentation
  area, all of it built with NGX-Ramblers itself
