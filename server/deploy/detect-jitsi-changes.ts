import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const DEPLOYED_REF_REMOTE = "refs/remotes/origin/jitsi-deployed";
const DEPLOYED_REF_REMOTE_SOURCE = "refs/heads/jitsi-deployed";

const JITSI_IMAGE_FILES = [
  "fly.jitsi.toml",
  "server/deploy/deploy-jitsi.ts",
  "server/deploy/detect-jitsi-changes.ts",
  ".github/workflows/build-push-and-deploy-ngx-ramblers-docker-image.yml",
  ".github/workflows/deploy-jitsi.yml"
];

function tryExec(command: string): string | null {
  try {
    return execSync(command, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function resolveBaseRef(): string {
  tryExec(`git fetch --no-tags --quiet origin ${DEPLOYED_REF_REMOTE_SOURCE}:${DEPLOYED_REF_REMOTE}`);
  const deployedSha = tryExec(`git rev-parse --verify --quiet ${DEPLOYED_REF_REMOTE}^{commit}`);
  const parentSha = tryExec("git rev-parse --verify --quiet HEAD~1^{commit}");
  return deployedSha || parentSha || "HEAD";
}

function isJitsiImageFile(file: string): boolean {
  return file.startsWith("jitsi/") || JITSI_IMAGE_FILES.includes(file);
}

function main(): void {
  const repoRoot = path.resolve(__dirname, "..", "..");
  process.chdir(repoRoot);

  const baseRef = resolveBaseRef();
  const afterRef = process.env.GITHUB_SHA || "HEAD";
  const changedFiles = execSync(`git diff --name-only ${baseRef} ${afterRef}`, { encoding: "utf-8" })
    .split("\n")
    .filter(line => line.length > 0);
  const jitsiChanges = changedFiles.filter(isJitsiImageFile);
  const jitsi = jitsiChanges.length > 0;

  console.error(`Comparing ${baseRef} .. ${afterRef}`);
  if (jitsi) {
    console.error("Jitsi image-affecting changes:");
    jitsiChanges.forEach(file => console.error(`  ${file}`));
  } else {
    console.error("No Jitsi image-affecting changes; skipping self-hosted Jitsi deploy");
  }

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `jitsi=${jitsi}\n`);
  } else {
    process.stdout.write(`jitsi=${jitsi}\n`);
  }
}

main();
