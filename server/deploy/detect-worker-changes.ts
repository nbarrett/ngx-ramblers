import { execSync } from "child_process";
import fs from "fs";
import madge from "madge";
import path from "path";
import { keys } from "es-toolkit/compat";

interface DetectResult {
  worker: boolean;
  changedFiles: string[];
  workerFiles: string[];
  beforeRef: string;
}

async function resolveWorkerFiles(repoRoot: string): Promise<string[]> {
  const entry = "server/lib/ramblers/ramblers-upload-worker-server.ts";
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
    "fly.worker.toml",
    "server/package.json",
    "server/package-lock.json",
    "server/playwright.config.ts",
    "server/deploy/deploy-ramblers-upload-worker.ts",
    "server/deploy/detect-worker-changes.ts",
    ".github/workflows/build-push-and-deploy-ngx-ramblers-docker-image.yml",
    ".github/workflows/build-and-deploy-ramblers-upload-worker.yml"
  ].forEach(s => resolved.add(s));

  return Array.from(resolved).sort();
}

function resolveBeforeRef(beforeInput: string | undefined): string {
  const zeros = "0000000000000000000000000000000000000000";
  if (!beforeInput || beforeInput === zeros) {
    return "HEAD~1";
  }
  try {
    execSync(`git cat-file -e ${beforeInput}^{commit}`, { stdio: "ignore" });
    return beforeInput;
  } catch {
    try {
      execSync(`git fetch --no-tags --quiet origin ${beforeInput}`, { stdio: "ignore" });
      execSync(`git cat-file -e ${beforeInput}^{commit}`, { stdio: "ignore" });
      return beforeInput;
    } catch {
      return "HEAD~1";
    }
  }
}

function diffChangedFiles(beforeRef: string, afterRef: string): string[] {
  const output = execSync(`git diff --name-only ${beforeRef} ${afterRef}`, {
    encoding: "utf-8"
  });
  return output.split("\n").filter(line => line.length > 0);
}

async function detect(): Promise<DetectResult> {
  const repoRoot = path.resolve(__dirname, "..", "..");
  process.chdir(repoRoot);

  const workerFiles = await resolveWorkerFiles(repoRoot);
  const workerFileSet = new Set(workerFiles);

  const beforeRef = resolveBeforeRef(process.env.GITHUB_EVENT_BEFORE);
  const afterRef = process.env.GITHUB_SHA || "HEAD";

  console.error(`Worker depends on ${workerFiles.length} files`);
  console.error(`Comparing ${beforeRef}..${afterRef}`);

  const changedAll = diffChangedFiles(beforeRef, afterRef);
  const changedFiles = changedAll.filter(f => workerFileSet.has(f));

  return { worker: changedFiles.length > 0, changedFiles, workerFiles, beforeRef };
}

async function main(): Promise<void> {
  const result = await detect();

  if (result.worker) {
    console.error("Worker-relevant files changed:");
    result.changedFiles.forEach(f => console.error(`  ${f}`));
  } else {
    console.error("No worker-relevant files changed");
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
