import { execSync } from "child_process";
import { pluraliseWithCount } from "../lib/shared/string-utils";
import fs from "fs";
import madge from "madge";
import path from "path";
import ts from "typescript";
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
  ignoredTypeOnly: string[];
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

function fileAtRef(ref: string, file: string): string {
  try {
    return execSync(`git show ${ref}:${file}`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function emittedJs(source: string, fileName: string): string | null {
  try {
    return ts.transpileModule(source, {
      fileName,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        isolatedModules: true,
        removeComments: true
      }
    }).outputText;
  } catch {
    return null;
  }
}

function isTranspilable(file: string): boolean {
  return file.endsWith(".ts") && !file.endsWith(".d.ts");
}

function affectsRuntime(file: string, baseRef: string, afterRef: string): boolean {
  if (!isTranspilable(file)) {
    return true;
  }
  const baseJs = emittedJs(fileAtRef(baseRef, file), file);
  const afterJs = emittedJs(fileAtRef(afterRef, file), file);
  if (baseJs === null || afterJs === null) {
    return true;
  }
  return baseJs !== afterJs;
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
  const changedWorkerFiles = changedAll.filter(f => workerFileSet.has(f));

  const changedFiles: string[] = [];
  const ignoredTypeOnly: string[] = [];
  changedWorkerFiles.forEach(f => {
    if (affectsRuntime(f, baseRef, afterRef)) {
      changedFiles.push(f);
    } else {
      ignoredTypeOnly.push(f);
    }
  });

  return {
    worker: changedFiles.length > 0,
    changedFiles,
    ignoredTypeOnly,
    workerFileCount: workerFiles.length,
    baseRef,
    baseSource
  };
}

async function main(): Promise<void> {
  const result = await detect();

  const sinceLabel = result.baseSource === BaseSource.WORKER_DEPLOYED ? "last deploy" : "previous commit (no worker-deployed ref yet)";

  if (result.ignoredTypeOnly.length > 0) {
    console.error(`Ignoring ${pluraliseWithCount(result.ignoredTypeOnly.length, "worker-graph file")} with type-only changes (identical emitted JS):`);
    result.ignoredTypeOnly.forEach(f => console.error(`  ${f}`));
  }

  if (result.worker) {
    console.error(`Worker-relevant runtime changes since ${sinceLabel}:`);
    result.changedFiles.forEach(f => console.error(`  ${f}`));
  } else {
    console.error(`No worker-relevant runtime changes since ${sinceLabel}`);
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
