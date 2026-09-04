import { Request, Response } from "express";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { BuildVersion, DEVELOPMENT_BUILD_NUMBER, DeploymentInfo, REPOSITORY_URL } from "../../../projects/ngx-ramblers/src/app/models/build-version.model";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow } from "../shared/dates";

const FLY_APP_PREFIX = "ngx-ramblers-";

function environmentValue(name: Environment): string | null {
  const value = (process.env[name] || "").trim();
  return value.length > 0 ? value : null;
}

export function environmentNameFrom(flyAppName: string | null, nodeEnv: string): string {
  if (flyAppName) {
    return flyAppName.startsWith(FLY_APP_PREFIX) ? flyAppName.substring(FLY_APP_PREFIX.length) : flyAppName;
  } else {
    return `local (${nodeEnv})`;
  }
}

export function imageTagFrom(flyImageRef: string | null, buildImageTag: string | null): string | null {
  const reference = flyImageRef || buildImageTag;
  return reference ? reference.replace(/^registry-1\.docker\.io\//, "").replace(/^docker\.io\//, "") : null;
}

export function currentDeploymentInfo(): DeploymentInfo {
  const now = dateTimeNow();
  const uptimeSeconds = Math.round(process.uptime());
  const commitSha = environmentValue(Environment.BUILD_COMMIT_SHA);
  const flyAppName = environmentValue(Environment.FLY_APP_NAME);
  return {
    buildNumber: environmentValue(Environment.BUILD_NUMBER) || DEVELOPMENT_BUILD_NUMBER,
    commitSha,
    commitShortSha: commitSha ? commitSha.substring(0, 9) : null,
    commitMessage: environmentValue(Environment.BUILD_COMMIT_MESSAGE),
    commitUrl: commitSha ? `${REPOSITORY_URL}/commit/${commitSha}` : null,
    branch: environmentValue(Environment.BUILD_BRANCH),
    builtAt: environmentValue(Environment.BUILD_TIMESTAMP),
    buildUrl: environmentValue(Environment.BUILD_URL),
    imageTag: imageTagFrom(environmentValue(Environment.FLY_IMAGE_REF), environmentValue(Environment.BUILD_IMAGE_TAG)),
    repositoryUrl: REPOSITORY_URL,
    environment: environmentNameFrom(flyAppName, envConfig.env),
    flyAppName,
    flyRegion: environmentValue(Environment.FLY_REGION),
    nodeVersion: process.version,
    uptimeSeconds,
    startedAt: now.minus({seconds: uptimeSeconds}).toISO(),
    serverTime: now.toISO()
  };
}

export function buildVersion(_req: Request, res: Response): void {
  const response: BuildVersion = {buildNumber: process.env[Environment.BUILD_NUMBER] || DEVELOPMENT_BUILD_NUMBER};
  res.set("Cache-Control", "no-store");
  res.json(response);
}

export function deploymentInfo(_req: Request, res: Response): void {
  res.set("Cache-Control", "no-store");
  res.json(currentDeploymentInfo());
}
