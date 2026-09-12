import { Command } from "commander";
import { log } from "../cli-logger";
import { watchAndDeployWorker, PROD_WORKER_APP } from "../../../deploy/watch-and-deploy-worker";
import {
  devWorkerAppName,
  devWorkerUrl,
  ensureDevWorkerDeployed,
  readActiveDevWorkerApp,
  destroyDevWorker
} from "../../../deploy/worker-dev-app";

export function createWorkerCommand(): Command {
  const worker = new Command("worker")
    .description("Integration worker development commands");

  worker
    .command("dev-up [suffix]")
    .description("Create (if needed) and deploy a personal, disposable integration worker on fly.io")
    .action(async suffix => {
      try {
        const appName = await ensureDevWorkerDeployed(suffix);
        log("\n✓ Dev worker ready: %s", devWorkerUrl(appName));
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  worker
    .command("dev-down [suffix]")
    .description("Destroy a personal dev integration worker created with 'worker dev-up'")
    .action(async suffix => {
      try {
        const appName = suffix ? devWorkerAppName(suffix) : (readActiveDevWorkerApp() || devWorkerAppName());
        log("Destroying %s...", appName);
        await destroyDevWorker(appName);
        log("✓ Destroyed");
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  worker
    .command("watch")
    .description("Watch server/lib and shared models, auto-deploying on change to the active dev worker (or the shared production worker if none is active)")
    .option("--app <appName>", "Fly app to deploy to, overriding auto-detection")
    .action(async options => {
      try {
        const targetApp = options.app || readActiveDevWorkerApp() || PROD_WORKER_APP;
        log("Auto-deploying changes to %s", targetApp);
        await watchAndDeployWorker(targetApp);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  return worker;
}
