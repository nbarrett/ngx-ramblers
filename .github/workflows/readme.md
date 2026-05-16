# GitHub Actions Workflow: Deploy to Selected Environments

This document explains how the `.github/workflows/deploy-to-environments.yml` workflow works,
what it needs configured, and how configuration and secrets reach each environment.

---

## Overview

This workflow redeploys one or more NGX-Ramblers environments to Fly.io using a **strategy
matrix**. The list of environments and all per-environment configuration come from the **admin
MongoDB database** — the same data managed in the app under Admin → Environment Setup. There is
no `configs.json` file; the workflow reads the database directly at run time.

---

## How the Workflow Works

### 1. Workflow Dispatch Inputs

- **environments**: Space-separated list of environment names, or `all` to deploy everywhere
  (default: `all`).
- **image_tag**: Docker image tag to deploy — `latest`, or a previous build run number
  (default: `latest`).

### 2. `set-environments` Job

- **Purpose**: Works out which environments the deploy matrix should cover.
- **Steps**:
  - Checks out the repository and sets up Node.js.
  - Installs root and `server/` dependencies.
  - **Resolve environment matrix from database** (`id: set-matrix`): connects to the admin
    database using the `ADMIN_MONGODB_URI` secret.
    - If `environments` is `all`, runs `server/deploy/list-environment-names.ts` to read every
      environment name from the database.
    - Otherwise, parses the space-separated input into a JSON array.
    - Writes the result to the `matrix` step output via `$GITHUB_OUTPUT`.
- **Job Output**: `matrix` — consumed by the `deploy` job.

### 3. `deploy` Job

- **Depends on**: `set-environments`.
- **Strategy Matrix**: runs once per environment, up to 6 in parallel (`max-parallel: 6`,
  `fail-fast: false`, so one failing environment does not stop the others).
- **GitHub Environment**: each matrix run uses `environment: <environment-name>`, so any
  GitHub Environment protection rules or environment-scoped secrets apply per environment.
- **Steps**:
  - Checks out the repository and sets up Node.js.
  - Installs root and `server/` dependencies, plus `ts-node`.
  - Logs in to Docker Hub using `DOCKER_USERNAME` / `DOCKER_PASSWORD`.
  - Installs and verifies Flyctl.
  - Runs `server/deploy/deploy-to-environments.ts --environment <name> --image-tag <tag>`,
    with `ADMIN_MONGODB_URI` available.

---

## What the Deploy Script Does

`server/deploy/deploy-to-environments.ts` reads the selected environment and the global
configuration from the admin database, then for each environment:

1. Builds the per-environment secret set (`server/lib/shared/secrets.ts`) — MongoDB URI, AWS
   credentials, application secret overrides, and the encrypted `CLOUDFLARE_CONFIG`.
2. Deploys the requested Docker image tag to the environment's Fly.io app.
3. Pushes the secret set to Fly, which restarts the app so it boots with the new values.

Because the script reads the database at run time, **whatever is saved in the admin database
when the workflow runs is what gets deployed.**

---

## Required GitHub Secrets

Configured once under the repository's **Settings → Secrets and variables → Actions** (and/or
per-environment under GitHub Environments):

| Secret | Used for |
|---|---|
| `ADMIN_MONGODB_URI` | Connection string to the admin database — source of all environment and global config |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | Docker Hub login to pull the application image |

Per-environment Fly.io API tokens, Cloudflare credentials, AWS keys and MongoDB credentials are
**not** GitHub secrets — they live in the admin database and are read by the deploy script.

---

## How to Add or Change an Environment

Environments are managed in the app, not in a file:

1. In NGX-Ramblers, go to **Admin → Environment Setup** and add or edit the environment
   (AWS, MongoDB, Fly.io, Cloudflare, application secrets).
2. **Save** — this writes to the admin database.
3. Trigger the workflow. `set-environments` reads the updated list from the database
   automatically; the matrix needs no manual editing.

---

## Updating a Shared Credential (e.g. a rolled Cloudflare token)

A credential reaches a running environment only through a deploy. To roll out a changed value:

1. Update it in **Admin → Environment Setup → Settings → Global** (or the per-environment
   override) and **Save**, so the new value is in the admin database.
2. Run this workflow for the affected environments. The deploy script re-reads the database,
   re-encrypts `CLOUDFLARE_CONFIG` (and any other secrets), and pushes them to Fly.

The Cloudflare token shipped to environments is `cloudflare.apiToken`. The separate
`webAnalyticsApiToken` field is used only for in-app Web Analytics site creation and is not
deployed.

---

## Useful Links

- [GitHub Actions Contexts](https://docs.github.com/en/actions/learn-github-actions/contexts)
- [GitHub Actions Matrix Strategy](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs)
- [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)

---

## Summary

- The workflow redeploys environments to Fly.io in parallel using a strategy matrix.
- The environment list and all per-environment configuration come from the admin database
  (`ADMIN_MONGODB_URI`), not from a file in the repository.
- To change config or credentials for an environment, save the change in the app, then run
  this workflow so the deploy script picks it up and pushes it to Fly.
