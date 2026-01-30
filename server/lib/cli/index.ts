#!/usr/bin/env node
import { Command } from "commander";
import { createEnvironmentCommand } from "./commands/environment";
import { createFlyCommand } from "./commands/fly";
import { createDatabaseCommand } from "./commands/database";
import { createAwsCommand } from "./commands/aws";
import { createValidateCommand } from "./commands/validate";
import { createDestroyCommand } from "./commands/destroy";
import { createLocalCommand } from "./commands/local";
import { createBackupCommand } from "./commands/backup";

export { createEnvironment, resumeEnvironment, validateEnvironmentRequest } from "./commands/environment";
export { deployToFlyio, scaleFlyApp, setFlySecrets } from "./commands/fly";
export { seedDatabase, validateDatabase, reinitDatabase } from "./commands/database";
export { createBucketAndUser, copyAssets } from "./commands/aws";
export { validateMongodb, validateAwsAdmin, validateRamblersApi } from "./commands/validate";
export { destroyEnvironment } from "./commands/destroy";
export { createBackup, restoreBackup } from "./commands/backup";

export * from "./types";

function configureHelp(cmd: Command): Command {
  cmd.helpOption("-h, --help", "display help for command");
  cmd.commands.forEach(sub => configureHelp(sub));
  return cmd;
}

function normalizeFlags(argv: string[]): string[] {
  return argv.map(arg => {
    if (arg === "--h") return "--help";
    if (arg === "-v" || arg === "--v") return "--version";
    return arg;
  });
}

const program = new Command();

program
  .name("ngx-cli")
  .description("NGX-Ramblers environment management CLI")
  .version("1.0.0")
  .helpOption("-h, --help", "display help for command");

program.addCommand(configureHelp(createEnvironmentCommand()));
program.addCommand(configureHelp(createFlyCommand()));
program.addCommand(configureHelp(createDatabaseCommand()));
program.addCommand(configureHelp(createAwsCommand()));
program.addCommand(configureHelp(createValidateCommand()));
program.addCommand(configureHelp(createDestroyCommand()));
program.addCommand(configureHelp(createLocalCommand()));
program.addCommand(configureHelp(createBackupCommand()));

if (require.main === module) {
  program.parse(normalizeFlags(process.argv));
}

export { program };
