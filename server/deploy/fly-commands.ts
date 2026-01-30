import path from "path";
import fs from "fs";
import debug from "debug";
import { execSync } from "child_process";
import { DeploymentConfig, EnvironmentConfig, RuntimeConfig, VolumeInformation } from "./types";
import { Environment } from "../lib/env-config/environment-model";
import { resolveClientPath } from "../lib/shared/path-utils";

const debugLog = debug("deploy-environments");
const debugNoLog = debug("deploy-environments-nolog");
debugLog.enabled = true;

export function flyTomlAbsolutePath() {
  return resolveClientPath("fly.toml");
}

export function readConfigFile(filePath: string): DeploymentConfig {
  try {
    const rawConfig = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(rawConfig) as DeploymentConfig;
  } catch (error) {
    debugLog(`Error reading or parsing config file: ${filePath}`, error);
    process.exit(1);
  }
}

export function runCommand(command: string, returnOutput: boolean = false, throwOnError: boolean = false): string {
  try {
    debugLog(`Running command: ${command}`);
    const output = execSync(command, { stdio: returnOutput ? "pipe" : "inherit", encoding: "utf-8" });
    return output || "";
  } catch (error) {
    debugLog(`Error running command: ${command}`, error);
    if (throwOnError) {
      throw error;
    }
    process.exit(1);
  }
}
export function createRuntimeConfig(): RuntimeConfig {
  const filterEnvironments: string[] = process.argv.slice(2).reduce((acc: string[], arg, index, args) => {
    if (arg === "--environment" && index + 1 < args.length) {
      return args[index + 1].split(" ").filter(env => env.trim() !== "");
    }
    return acc;
  }, []);

  const currentDir = path.resolve(__dirname);
  const configFilePath = path.resolve(currentDir, "../../non-vcs/fly-io/configs.json");
  return {currentDir, configFilePath, targetEnvironments: filterEnvironments};
}

function findAttributeForIndex(outputLines: string[], columnHeading: string, header: string[]) {
  const index = header.indexOf(columnHeading);
  if (index === -1) {
    debugLog("Warning: Could not parse " + columnHeading + " header from output" + header.join(", "));
  } else {
    return outputLines.slice(1).map(line => {
      const columns = line.split("\t").map(col => col.trim());
      const returnData = columns[index];
      debugNoLog("findAttributeForIndex:line:", line, "columns:", columns, "columnHeading:", columnHeading, "index:", index, "returnData:", returnData);
      return returnData;
    })?.[0];
  }
}

function cleanId(id: string): string {
  return (id || "").replace("*", "");
}

function queryExistingVolume(appName: string): VolumeInformation {
  try {
    const output = execSync(`flyctl volumes list --app ${appName}`, { encoding: "utf-8" });
    const outputLines = output.split("\n").filter(line => line);
    debugLog(`queryExistingVolumeName:outputLines:`, outputLines);
    const header = outputLines[0].split("\t").map(col => col.trim());
    const id = findAttributeForIndex(outputLines, "ID", header);
    const region = findAttributeForIndex(outputLines, "REGION", header);
    const attachedVM = findAttributeForIndex(outputLines, "ATTACHED VM", header);
    const oneOrMoreUnreachable: boolean = outputLines.some(line => line.includes("could not be reached"));
    return {region, id: cleanId(id), reachable: !oneOrMoreUnreachable && id && !id?.endsWith("*"), attachedVM};
  } catch (error) {
    debugLog(`Error retrieving existing volume name: ${error}`);
    return null;
  }
}

function destroyMachineAttachedToVolume(appName: string, volumeName: string, machineId: string): void {
  try {
    debugLog(`Volume ${volumeName} is attached to machine ${machineId}, therefore machine must be stopped and destroyed before volume can be deleted`);
    runCommand(`flyctl machine stop ${machineId} --app ${appName}`);
    runCommand(`flyctl machine destroy ${machineId} --app ${appName} --force`);
  } catch (error) {
    debugLog(`Failed to detach volume '${volumeName}' from machine '${machineId}':`, error);
    process.exit(1);
  }
}

export function deleteVolumeIfExists(appName: string, region: string): void {
  const volumeInformation: VolumeInformation = queryExistingVolume(appName);
  if (!volumeInformation?.id) {
    debugLog(`No existing volume found in region ${region} for app ${appName}`);
  } else {
    debugLog(`Volume information queried:`, volumeInformation, `for app ${appName}`);
    try {
      if (volumeInformation.attachedVM) {
        destroyMachineAttachedToVolume(appName, volumeInformation.id, volumeInformation.attachedVM);
      }
      if (volumeInformation.reachable) {
        debugLog(`Existing reachable volume ${volumeInformation.id} found in region ${region} - deleting it...`);
        runCommand(`flyctl volumes destroy ${volumeInformation.id} --app ${appName} --yes`);
      } else {
        debugLog(`Existing volume ${volumeInformation.id} is not reachable - skipping delete... deploy still should work`);
      }
    } catch (error) {
      debugLog(`Failed to delete volume '${volumeInformation}': `, error);
      process.exit(1);
    }
  }
}
export function createVolumeIfNotExists(appName: string, volumeName: string, region: string): void {
  const existingVolume: VolumeInformation = queryExistingVolume(appName);

  if (!existingVolume) {
    debugLog(`No existing volume found in region '${region}'. Creating '${volumeName}'...`);
    runCommand(`flyctl volumes create ${volumeName} --app ${appName} --region ${region}`);
    return;
  }

  const currentRegion = existingVolume.region;
  if (currentRegion !== region) {
    debugLog(`Volume '${existingVolume}' is in region '${currentRegion}', but '${region}' is required. Recreating it as '${volumeName}'...`);
    try {
      runCommand(`flyctl volumes delete ${existingVolume} --app ${appName} -y`);
    } catch (error) {
      if (error.message.includes("volume not found")) {
        debugLog(`Volume '${existingVolume}' not found during deletion. Proceeding to recreate '${volumeName}'.`);
      } else {
        debugLog(`Failed to delete volume '${existingVolume}': ${error}.`);
        process.exit(1);
      }
    }
    runCommand(`flyctl volumes create ${volumeName} --app ${appName} --region ${region}`);
    return;
  }

  debugLog(`Volume '${existingVolume.id}' exists in the correct region '${region}'. Using it as '${volumeName}'.`);
}

export function configureEnvironment(environmentConfig: EnvironmentConfig, config: DeploymentConfig) {
  process.env[Environment.FLY_API_TOKEN] = environmentConfig.apiKey;
  process.env[Environment.APP_NAME] = environmentConfig.appName;
  process.env[Environment.IMAGE] = config.dockerImage;
}
