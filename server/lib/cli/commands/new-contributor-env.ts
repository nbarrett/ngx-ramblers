import { Command } from "commander";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { homedir } from "os";
import { log } from "../cli-logger";
import { resolveClientPath } from "../../shared/path-utils";
import { buildEnvironmentsManifest, generateAuthSecret } from "../../contributor-environment/contributor-bundle";

function runGit(args: string[]): void {
  const result = spawnSync("git", args, { stdio: ["ignore", "inherit", "inherit"] });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed`);
  }
}

function resolveDestination(destination: string): string {
  const expanded = destination.startsWith("~")
    ? path.join(homedir(), destination.slice(1))
    : destination;
  return path.resolve(expanded);
}

function ensureCheckout(sourceDir: string, destPath: string): void {
  if (fs.existsSync(destPath)) {
    if (!fs.existsSync(path.join(destPath, ".git"))) {
      throw new Error(`${destPath} exists but is not a git checkout`);
    }
    log("Refreshing existing checkout at %s to latest main", destPath);
    runGit(["-C", destPath, "fetch", "origin"]);
    runGit(["-C", destPath, "reset", "--hard", "origin/main"]);
  } else {
    log("Cloning %s into %s", sourceDir, destPath);
    runGit(["clone", "--no-hardlinks", sourceDir, destPath]);
  }
}

function ensureSecretsFile(sourceSecrets: string, destSecrets: string): void {
  if (!fs.existsSync(destSecrets)) {
    fs.copyFileSync(sourceSecrets, destSecrets);
    log("Copied secrets file to %s", destSecrets);
  }
  const content = fs.readFileSync(destSecrets, "utf-8");
  const lines = content.split(/\r?\n/);
  const hasAuthSecret = lines.some(line => line.startsWith("AUTH_SECRET="));
  const hasNodeEnv = lines.some(line => line.startsWith("NODE_ENV="));
  const additions = [
    ...(hasAuthSecret ? [] : [`AUTH_SECRET=${generateAuthSecret()}`]),
    ...(hasNodeEnv ? [] : ["NODE_ENV=development"])
  ];
  if (additions.length === 0) {
    log("Secrets file already complete - keeping it");
  } else {
    const base = content.length === 0 || content.endsWith("\n") ? content : `${content}\n`;
    fs.writeFileSync(destSecrets, base + additions.map(entry => `${entry}\n`).join(""));
    log("Added missing keys to secrets file: %s", additions.map(entry => entry.split("=")[0]).join(", "));
  }
}

function writeManifest(destSecretsDir: string, environment: string, appName: string): void {
  fs.writeFileSync(path.join(destSecretsDir, "environments.local.json"), buildEnvironmentsManifest(environment, appName));
  log("Wrote environments.local.json for %s", environment);
}

export function createNewContributorEnvCommand(): Command {
  return new Command("new-contributor-env")
    .description("Create or refresh a local single-group contributor checkout and start it")
    .argument("<environment>", "group environment name, e.g. pang-valley")
    .argument("<destination>", "path for the contributor checkout")
    .option("--no-start", "assemble the checkout but do not start the stack")
    .action((environment: string, destination: string, options: { start: boolean }) => {
      try {
        const sourceDir = resolveClientPath();
        const appName = `ngx-ramblers-${environment}`;
        const sourceSecrets = path.join(sourceDir, "non-vcs/secrets", `secrets.${appName}.env`);
        if (!fs.existsSync(sourceSecrets)) {
          throw new Error(`Secrets file not found in this checkout: ${sourceSecrets}`);
        }
        const destPath = resolveDestination(destination);
        if (destPath === sourceDir) {
          throw new Error("Destination must be different from the source checkout");
        }

        ensureCheckout(sourceDir, destPath);

        const destSecretsDir = path.join(destPath, "non-vcs/secrets");
        fs.mkdirSync(destSecretsDir, { recursive: true });
        ensureSecretsFile(sourceSecrets, path.join(destSecretsDir, `secrets.${appName}.env`));
        writeManifest(destSecretsDir, environment, appName);

        if (options.start) {
          log("Starting the stack at %s (binds ports 4200 and 5001)", destPath);
          const result = spawnSync(path.join(destPath, "bin/ngx-cli"), ["local", "dev", environment, "--no-docker-worker"], {
            stdio: "inherit",
            cwd: destPath
          });
          process.exit(result.status === null ? 0 : result.status);
        } else {
          log("Checkout ready at %s (start skipped)", destPath);
        }
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });
}
