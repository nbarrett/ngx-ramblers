import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";

const {values} = parseArgs({
  options: {
    help: {type: "boolean", short: "h"},
    screenshots: {type: "boolean"}
  },
  strict: true
});

if (values.help) {
  process.stdout.write("Usage: npm run serenity -- [--screenshots]\n\n--screenshots  Capture a screenshot after every Serenity interaction\n");
} else {
  const environment = {
    ...process.env,
    [Environment.SERENITY_SCREENSHOTS]: String(!!values.screenshots)
  };
  const clean = spawnSync("npm", ["run", "clean"], {env: environment, stdio: "inherit"});
  const run = clean.status === 0
    ? spawnSync("npm", ["run", "serenity-run"], {env: environment, stdio: "inherit"})
    : null;
  const report = spawnSync("npm", ["run", "report"], {env: environment, stdio: "inherit"});
  process.exitCode = Math.max(clean.status || 0, run?.status || 0, report.status || 0);
}
