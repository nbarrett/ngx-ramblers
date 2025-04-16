import path from "path";
import fs from "fs";
import debug from "debug";
import { execSync } from "child_process";

const debugLog = debug("deploy-environments");
debugLog.enabled = true;

export interface EnvironmentConfig {
  name: string;
  apiKey: string;
  appName: string;
  memory: string;
}

export interface DeploymentConfig {
  environments: EnvironmentConfig[];
  dockerImage: string;
  region: string;
}

export interface RuntimeConfig {
  currentDir: string;
  configFilePath: string;
  targetEnvironments: string[];
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

export function runCommand(command: string): void {
  try {
    debugLog(`Running command: ${command}`);
    execSync(command, {stdio: "inherit"});
  } catch (error) {
    debugLog(`Error running command: ${command}`, error);
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

function queryExistingVolumeName(appName: string, region: string): string | null {
  try {
    const output = execSync(`flyctl volumes list --app ${appName}`, {encoding: "utf-8"});
    const outputLines = output.split("\n").filter(line => line.trim() !== ""); // Remove empty lines
    debugLog(`queryExistingVolumeName:outputLines:`, outputLines);

    const header = outputLines[0].split("\t").map(col => col.trim());
    const regionIndex = header.indexOf("REGION");
    const attachedVmIndex = header.indexOf("ATTACHED VM");
    const idIndex = header.indexOf("ID");

    if (regionIndex === -1 || attachedVmIndex === -1 || idIndex === -1) {
      debugLog("Error: Could not parse volume list header.");
      return null;
    }

    for (const line of outputLines.slice(1)) {
      const columns = line.split("\t").map(col => col.trim());
      if (columns[regionIndex] === region && !columns[attachedVmIndex]) {
        return columns[idIndex]; // Return the volume ID
      }
    }

    return null;
  } catch (error) {
    debugLog(`Error retrieving existing volume name: ${error}`);
    return null;
  }
}
function isVolumeUnattached(appName: string, volumeName: string): boolean {
  try {
    const output = execSync(`flyctl volumes list --app ${appName}`, {encoding: "utf-8"});
    const volumeLine = output.split("\n").find(line => line.includes(volumeName));
    return volumeLine && volumeLine.includes("Unattached");
  } catch (error) {
    debugLog(`Error checking if volume is unattached: ${error}`);
    return false;
  }
}

function getVolumeRegion(appName: string, volumeName: string): string | null {
  try {
    const output = execSync(`flyctl volumes list --app ${appName}`, {encoding: "utf-8"});
    const volumeLine = output.split("\n").find(line => line.includes(volumeName));
    if (volumeLine) {
      const regionMatch = volumeLine.match(/\b[A-Za-z]{3}\b/); // Match region code (e.g., "ams", "lhr")
      return regionMatch ? regionMatch[0] : null;
    }
    return null;
  } catch (error) {
    debugLog(`Error retrieving volume region: ${error}`);
    return null;
  }
}

export function createVolumeIfNotExists(appName: string, volumeName: string, region: string): void {
  const existingVolumeName = queryExistingVolumeName(appName, region);

  if (!existingVolumeName) {
    debugLog(`No existing volume found. Creating '${volumeName}' in region '${region}'...`);
    runCommand(`flyctl volumes create ${volumeName} --app ${appName} --region ${region}`);
  }

  const currentRegion = getVolumeRegion(appName, existingVolumeName);
  if (currentRegion !== region) {
    debugLog(`Volume '${existingVolumeName}' is in region '${currentRegion}', but '${region}' is required. Recreating it as '${volumeName}'...`);
    try {
      runCommand(`flyctl volumes delete ${existingVolumeName} --app ${appName} -y`);
    } catch (error) {
      if (error.message.includes("volume not found")) {
        debugLog(`Volume '${existingVolumeName}' not found during deletion. Proceeding to recreate '${volumeName}'.`);
      } else {
        debugLog(`Failed to delete volume '${existingVolumeName}': ${error}.`);
        process.exit(1);
      }
    }
    runCommand(`flyctl volumes create ${volumeName} --app ${appName} --region ${region}`);
  }

  if (!isVolumeUnattached(appName, existingVolumeName)) {
    debugLog(`Volume '${existingVolumeName}' is attached. Detaching it for use as '${volumeName}'...`);
    try {
      runCommand(`flyctl volumes delete ${existingVolumeName} --app ${appName} -y`);
    } catch (error) {
      if (error.message.includes("volume not found")) {
        debugLog(`Volume '${existingVolumeName}' not found during deletion. Proceeding to recreate '${volumeName}'.`);
      } else {
        debugLog(`Failed to delete volume '${existingVolumeName}': ${error}.`);
        process.exit(1);
      }
    }
    runCommand(`flyctl volumes create ${volumeName} --app ${appName} --region ${region}`);
  }

  debugLog(`Volume '${existingVolumeName}' exists, is unattached, and in the correct region '${region}'. Using it as '${volumeName}'.`);
}

export function configureEnvironment(environmentConfig: EnvironmentConfig, config: DeploymentConfig) {
  process.env.FLY_API_TOKEN = environmentConfig.apiKey;
  process.env.APP_NAME = environmentConfig.appName;
  process.env.IMAGE = config.dockerImage;
}
