import { execSync } from "child_process";
import fs from "fs";
import madge from "madge";
import path from "path";
import { keys } from "es-toolkit/compat";

const DEPLOYED_REF_REMOTE = "refs/remotes/origin/worker-deployed";
const DEPLOYED_REF_REMOTE_SOURCE = "refs/heads/worker-deployed";

enum BaseSource {
  WORKER_DEPLOYED = "worker-deployed",
  FALLBACK_PARENT = "fallback-parent"
}

interface DetectResult {
  worker: boolean;
  changedFiles: string[];
  workerFileCount: number;
  baseRef: string;
  baseSource: BaseSource;
}

async function resolveWorkerFiles(repoRoot: string): Promise<string[]> {
  const entry = "server/lib/ramblers/integration-worker-server.ts";
  const entryAbs = path.resolve(repoRoot, entry);
  const entryDir = path.dirname(entryAbs);

  const result = await madge(entryAbs, {
    fileExtensions: ["ts"],
    detectiveOptions: { ts: { skipTypeImports: false } }
  });

  const graph = result.obj();
  const resolved = new Set<string>();
  resolved.add(entry);
  keys(graph).forEach(p => {
    const abs = path.resolve(entryDir, p);
    const rel = path.relative(repoRoot, abs);
    if (!rel.startsWith("..")) {
      resolved.add(rel);
    }
    (graph[p] || []).forEach(child => {
      const childAbs = path.resolve(entryDir, child);
      const childRel = path.relative(repoRoot, childAbs);
      if (!childRel.startsWith("..")) {
        resolved.add(childRel);
      }
    });
  });

  [
    "Dockerfile",
    "fly.integration-worker.toml",
    "server/package.json",
    "server/package-lock.json",
    "server/playwright.config.ts",
    "server/deploy/deploy-integration-worker.ts",
    "server/deploy/detect-worker-changes.ts",
    ".github/workflows/build-push-and-deploy-ngx-ramblers-docker-image.yml",
    ".github/workflows/build-and-deploy-integration-worker.yml"
  ].forEach(s => resolved.add(s));

  return Array.from(resolved).sort();
}

function tryExec(command: string): string | null {
  try {
    return execSync(command, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function resolveBaseRef(): { ref: string; source: BaseSource } {
  tryExec(`git fetch --no-tags --quiet origin ${DEPLOYED_REF_REMOTE_SOURCE}:${DEPLOYED_REF_REMOTE}`);
  const sha = tryExec(`git rev-parse --verify --quiet ${DEPLOYED_REF_REMOTE}^{commit}`);
  if (sha) {
    return { ref: sha, source: BaseSource.WORKER_DEPLOYED };
  }
  return { ref: "HEAD~1", source: BaseSource.FALLBACK_PARENT };
}

function diffChangedFiles(baseRef: string, afterRef: string): string[] {
  const output = execSync(`git diff --name-only ${baseRef} ${afterRef}`, { encoding: "utf-8" });
  return output.split("\n").filter(line => line.length > 0);
}

async function detect(): Promise<DetectResult> {
  const repoRoot = path.resolve(__dirname, "..", "..");
  process.chdir(repoRoot);

  const workerFiles = await resolveWorkerFiles(repoRoot);
  const workerFileSet = new Set(workerFiles);

  const { ref: baseRef, source: baseSource } = resolveBaseRef();
  const afterRef = process.env.GITHUB_SHA || "HEAD";

  console.error(`Worker depends on ${workerFiles.length} files`);
  console.error(`Comparing ${baseRef} (${baseSource}) .. ${afterRef}`);

  const changedAll = diffChangedFiles(baseRef, afterRef);
  const changedFiles = changedAll.filter(f => workerFileSet.has(f));

  return {
    worker: changedFiles.length > 0,
    changedFiles,
    workerFileCount: workerFiles.length,
    baseRef,
    baseSource
  };
}

async function main(): Promise<void> {
  const result = await detect();

  if (result.worker) {
    console.error(`Worker-relevant files changed since ${result.baseSource === BaseSource.WORKER_DEPLOYED ? "last deploy" : "previous commit (no worker-deployed ref yet)"}:`);
    result.changedFiles.forEach(f => console.error(`  ${f}`));
  } else {
    console.error(`No worker-relevant files changed since ${result.baseSource === BaseSource.WORKER_DEPLOYED ? "last deploy" : "previous commit"}`);
  }

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `worker=${result.worker}\n`);
  } else {
    process.stdout.write(`worker=${result.worker}\n`);
  }
}

void main().catch(error => {
  console.error("Failed to detect worker changes:", error);
  process.exit(1);
});
