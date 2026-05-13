import { Command } from "commander";
import debug from "debug";
import * as cms from "./cms-client.js";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { envConfig } from "../env-config/env-config";
import { DEFAULT_CMS_BASE_URL } from "./models.js";
import { syncReleaseNotesIndexImages } from "./index-image-sync.js";

const debugLog = debug(envConfig.logNamespace("refresh-camera-markers"));
debugLog.enabled = true;

interface CliOptions {
  cmsUrl: string;
  username: string;
  password: string;
  dryRun: boolean;
}

async function run(options: CliOptions): Promise<void> {
  const auth = await cms.login(options.cmsUrl, options.username, options.password);
  await syncReleaseNotesIndexImages(auth, {
    dryRun: options.dryRun,
    log: message => debugLog(message)
  });
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("refresh-camera-markers")
    .description("Recompute 📸 markers on the release-notes index pages from current sub-page image content")
    .option("--cms-url <url>", "CMS base URL", process.env[Environment.CMS_URL] || DEFAULT_CMS_BASE_URL)
    .option("--username <username>", "CMS username")
    .option("--password <password>", "CMS password")
    .option("--dry-run", "Preview changes without saving", false);

  program.parse(process.argv);

  const opts = program.opts() as { cmsUrl: string; username?: string; password?: string; dryRun?: boolean };
  const username = opts.username || process.env[Environment.CMS_USERNAME];
  const password = opts.password || process.env[Environment.CMS_PASSWORD];

  if (!username || !password) {
    console.error("Username and password are required. Provide --username/--password or set CMS_USERNAME/CMS_PASSWORD.");
    process.exit(1);
  }

  await run({
    cmsUrl: opts.cmsUrl,
    username,
    password,
    dryRun: Boolean(opts.dryRun)
  });
}

main().catch(err => {
  console.error("refresh-camera-markers failed:", err);
  process.exit(1);
});
