# GitHub Actions Workflow: Deploy to Selected Environments

This document explains how the `.github/workflows/deploy-to-environments.yml` workflow works, how to configure it, and how its key features operate.

---

## Overview

This workflow automates deployment to multiple environments using a **strategy matrix**. It reads environment configurations from a JSON file and deploys to each selected environment in parallel.

---

## How the Workflow Works

### 1. Workflow Dispatch Inputs

- **environments**: Space-separated list of environment names or `all` to deploy everywhere.
- **image_tag**: Docker image tag to deploy (default: `latest`).

### 2. `set-environments` Job

- **Purpose**: Determines which environments to deploy to.
- **Steps**:
  - Checks out the repository.
  - Creates the configs directory.
  - Writes the `configs.json` file from a secret.
  - **Step with `id: set-matrix`**:
    - If `environments` is `all`, uses `jq` to extract all environment names from `configs.json`.
    - Otherwise, parses the user input into a JSON array.
    - Sets a step output called `matrix` by writing to `$GITHUB_OUTPUT`.
  - Cleans up sensitive files.

- **Job Output**:
  - The job defines an output called `matrix`, mapped from the step output:  
    `outputs: matrix: ${{ steps.set-matrix.outputs.matrix }}`

### 3. `deploy` Job

- **Depends on**: `set-environments`
- **Strategy Matrix**:
  - Uses the output from `set-environments` to create a matrix of environments:  
    `matrix: environment: ${{ fromJson(needs.set-environments.outputs.matrix) }}`
  - Runs the deploy steps once for each environment in the matrix, in parallel.

- **Steps**:
  - Checks out the repository.
  - Sets up Node.js.
  - Installs dependencies.
  - Recreates the configs directory and file.
  - Installs `ts-node`.
  - Logs in to Docker Hub.
  - Installs and verifies Flyctl.
  - Runs the deployment script for the current environment.
  - Cleans up sensitive files.

---

## How to Add or Change Environments

1. **Edit** `non-vcs/fly-io/configs.json`:
  - Add or modify objects in the `environments` array.
  - Each environment should have:
    - `name`, `apiKey`, `appName`, `memory`, `scaleCount`
2. **Save the file**.
3. **Trigger the workflow**. The matrix will update automatically.

---

## Key Concepts

### Strategy Matrix

- Allows running a job multiple times with different input values (environments).
- Enables parallel deployments and easy scaling.

### Outputs and Inputs

- **Step Outputs**: Set by writing `echo "name=value" >> $GITHUB_OUTPUT` in a step.
- **Job Outputs**: Expose step outputs for use in other jobs.
- **Inputs**: Values provided by the user when triggering the workflow.

### Referencing Outputs

- Reference step outputs: `${{ steps.<step_id>.outputs.<output_name> }}`
- Reference job outputs: `${{ needs.<job_id>.outputs.<output_name> }}`

**Note:** The `id` used in steps (e.g., `set-matrix`) must match the reference in outputs. You can rename it, but all references must be updated accordingly.

---

## Useful Links

- [GitHub Actions Contexts Documentation](https://docs.github.com/en/actions/learn-github-actions/contexts)
- [GitHub Actions Matrix Strategy](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs)

---

## Example: Adding a New Environment

Add to `configs.json`:

```json
{
  "name": "new-environment",
  "apiKey": "FlyV1 <your-api-key>",
  "appName": "ngx-ramblers-new-environment",
  "memory": "512mb",
  "scaleCount": 1
}
```

---

## Summary

- The workflow deploys to multiple environments in parallel using a matrix.
- Environments are defined in `configs.json`.
- Outputs and inputs are used to pass data between steps and jobs.
- The workflow is flexible and easy to extend by editing the config file.
