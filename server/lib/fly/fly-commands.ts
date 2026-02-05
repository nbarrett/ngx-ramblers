import path from "path";
import fs from "fs";
import debug from "debug";
import { execSync, spawn, ChildProcess } from "child_process";
import { DeploymentConfig, EnvironmentConfig, RuntimeConfig, VolumeInformation } from "../../deploy/types";
import { Environment } from "../env-config/environment-model";
import { resolveClientPath } from "../shared/path-utils";
import { configsJsonPath } from "../shared/configs-json";
import { envConfig } from "../env-config/env-config";

export type OutputCallback = (line: string) => void;

const debugLog = debug(envConfig.logNamespace("deploy-environments"));
const debugNoLog = debug(envConfig.logNamespace("deploy-environments-nolog"));
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

export interface StreamingCommandResult {
  exitCode: number;
  output: string;
}

export function runCommandStreaming(
  command: string,
  onOutput?: OutputCallback
): Promise<StreamingCommandResult> {
  return new Promise((resolve, reject) => {
    debugLog(`Running streaming command: ${command}`);

    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/sh";
    const shellArgs = isWindows ? ["/c", command] : ["-c", command];

    const child: ChildProcess = spawn(shell, shellArgs, {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env
    });

    let output = "";
    let lineBuffer = "";

    const processLine = (line: string): void => {
      if (line.trim()) {
        output += line + "\n";
        if (onOutput) {
          onOutput(line);
        }
        debugLog(`[stream] ${line}`);
      }
    };

    const processChunk = (chunk: Buffer): void => {
      const text = chunk.toString();
      lineBuffer += text;

      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() || "";

      for (const line of lines) {
        processLine(line);
      }
    };

    if (child.stdout) {
      child.stdout.on("data", processChunk);
    }

    if (child.stderr) {
      child.stderr.on("data", processChunk);
    }

    child.on("error", (error: Error) => {
      debugLog(`Command error: ${error.message}`);
      reject(error);
    });

    child.on("close", (code: number | null) => {
      if (lineBuffer.trim()) {
        processLine(lineBuffer);
      }

      const exitCode = code ?? 0;
      debugLog(`Command exited with code: ${exitCode}`);

      if (exitCode === 0) {
        resolve({ exitCode, output });
      } else {
        const error = new Error(`Command failed with exit code ${exitCode}: ${command}`);
        (error as any).exitCode = exitCode;
        (error as any).output = output;
        reject(error);
      }
    });
  });
}
export function createRuntimeConfig(): RuntimeConfig {
  const filterEnvironments: string[] = process.argv.slice(2).reduce((acc: string[], arg, index, args) => {
    if (arg === "--environment" && index + 1 < args.length) {
      return args[index + 1].split(" ").filter(env => env.trim() !== "");
    }
    return acc;
  }, []);

  const currentDir = path.resolve(__dirname);
  const configFilePath = configsJsonPath();
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
