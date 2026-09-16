import { Command } from "commander";
import mongoose from "mongoose";
import { isNil, isObject } from "es-toolkit/compat";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { EnvironmentsConfig } from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import * as configController from "../../mongo/controllers/config";
import { connect } from "../../mongo/mongoose-client";
import { error as logError } from "../cli-logger";

function valueAtPath(root: any, dottedPath: string): any {
  return dottedPath.split(".").filter(Boolean).reduce((current, key) => isNil(current) ? undefined : current[key], root);
}

function printable(value: any): string {
  if (isNil(value)) {
    return "";
  } else if (isObject(value)) {
    return JSON.stringify(value);
  } else {
    return String(value);
  }
}

export function createEnvironmentsValueCommand(): Command {
  return new Command("environments-value")
    .description("Print one value from the platform environments document, decrypted, by dotted path")
    .argument("<path>", "dotted path such as cms.username or uploadWorker.appName; with --environment, a path within that environment such as mongo.password")
    .option("-e, --environment <name>", "resolve the path within the named environment's entry")
    .action(async (dottedPath: string, options: {environment?: string}) => {
      try {
        await connect();
        const document = await configController.queryKey(ConfigKey.ENVIRONMENTS);
        const root: EnvironmentsConfig = document?.value || {};
        const scope = options.environment
          ? (root.environments || []).find(item => item.environment === options.environment)
          : root;
        if (options.environment && !scope) {
          throw new Error(`no environment named ${options.environment}; known: ${(root.environments || []).map(item => item.environment).join(", ")}`);
        } else {
          process.stdout.write(`${printable(valueAtPath(scope, dottedPath))}\n`);
        }
      } catch (error) {
        logError(error.message);
        process.exitCode = 1;
      } finally {
        await mongoose.connection.close();
      }
    });
}
