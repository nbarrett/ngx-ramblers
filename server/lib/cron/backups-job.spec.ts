import expect from "expect";
import { afterEach, describe, it } from "mocha";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { platformBackupSchedulerEnabled } from "./backups-job";

const savedNodeEnv = process.env[Environment.NODE_ENV];
const savedPlatformAdminEnabled = process.env[Environment.PLATFORM_ADMIN_ENABLED];
const savedFlyAppName = process.env[Environment.FLY_APP_NAME];
const savedFlyMachineId = process.env[Environment.FLY_MACHINE_ID];

function restoreVariable(name: Environment, value: string | undefined): void {
  if (value) {
    process.env[name] = value;
  } else {
    delete process.env[name];
  }
}

function restoreEnvironment(): void {
  restoreVariable(Environment.NODE_ENV, savedNodeEnv);
  restoreVariable(Environment.PLATFORM_ADMIN_ENABLED, savedPlatformAdminEnabled);
  restoreVariable(Environment.FLY_APP_NAME, savedFlyAppName);
  restoreVariable(Environment.FLY_MACHINE_ID, savedFlyMachineId);
}

describe("platformBackupSchedulerEnabled", () => {
  afterEach(() => restoreEnvironment());

  it("is disabled for local platform-admin development", () => {
    process.env[Environment.NODE_ENV] = "development";
    process.env[Environment.PLATFORM_ADMIN_ENABLED] = "true";
    process.env[Environment.FLY_APP_NAME] = "";
    process.env[Environment.FLY_MACHINE_ID] = "";

    expect(platformBackupSchedulerEnabled()).toEqual(false);
  });

  it("is disabled for non-Fly production processes", () => {
    process.env[Environment.NODE_ENV] = "production";
    process.env[Environment.PLATFORM_ADMIN_ENABLED] = "true";
    process.env[Environment.FLY_APP_NAME] = "";
    process.env[Environment.FLY_MACHINE_ID] = "";

    expect(platformBackupSchedulerEnabled()).toEqual(false);
  });

  it("is enabled for platform-admin Fly production processes", () => {
    process.env[Environment.NODE_ENV] = "production";
    process.env[Environment.PLATFORM_ADMIN_ENABLED] = "true";
    process.env[Environment.FLY_APP_NAME] = "ngx-ramblers";
    process.env[Environment.FLY_MACHINE_ID] = "";

    expect(platformBackupSchedulerEnabled()).toEqual(true);
  });
});
