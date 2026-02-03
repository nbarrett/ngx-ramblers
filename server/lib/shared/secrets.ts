import fs from "fs";
import path from "path";
import debug from "debug";
import { SecretsFile } from "../environment-setup/types";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("shared:secrets"));

export function secretsDirectory(): string {
  return path.resolve(__dirname, "../../../non-vcs/secrets");
}

export function secretsPath(appName: string): string {
  return path.join(secretsDirectory(), `secrets.${appName}.env`);
}

export function parseSecretsFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    debugLog("Secrets file not found:", filePath);
    return {};
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return parseSecretsContent(content);
}

export function parseSecretsContent(content: string): Record<string, string> {
  const secrets: Record<string, string> = {};

  content.split("\n").forEach((line: string) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const equalsIndex = trimmedLine.indexOf("=");
    if (equalsIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, equalsIndex).trim();
    const value = trimmedLine.slice(equalsIndex + 1).trim().replace(/^"|"$/g, "");

    if (key) {
      secrets[key] = value;
    }
  });

  return secrets;
}

export function buildSecretsContent(secrets: Record<string, string>): string {
  return Object.entries(secrets)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n";
}

export function writeSecretsFile(filePath: string, secrets: Record<string, string>): void {
  const secretsContent = buildSecretsContent(secrets);
  const directory = path.dirname(filePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    debugLog("Created secrets directory:", directory);
  }

  fs.writeFileSync(filePath, secretsContent, { encoding: "utf-8" });
  debugLog("Wrote secrets file:", filePath);
}

export function loadSecretsForEnvironment(appName: string): SecretsFile {
  const filePath = secretsPath(appName);
  const secrets = parseSecretsFile(filePath);

  return {
    path: filePath,
    secrets
  };
}

export function secretsExist(appName: string): boolean {
  return fs.existsSync(secretsPath(appName));
}

export function updateSecretsFile(appName: string, newSecrets: Record<string, string>): void {
  const filePath = secretsPath(appName);
  const existingSecrets = parseSecretsFile(filePath);
  const mergedSecrets = { ...existingSecrets, ...newSecrets };
  writeSecretsFile(filePath, mergedSecrets);
  debugLog("Updated secrets file with new keys:", Object.keys(newSecrets));
}
