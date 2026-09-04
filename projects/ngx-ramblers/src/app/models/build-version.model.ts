import { AdminPath } from "./admin-route-paths.model";
export interface BuildVersion {
  buildNumber: string;
}

export const DEVELOPMENT_BUILD_NUMBER = "development";

export const VERSION_CHECK_INTERVAL_MS = 60000;
export const REPOSITORY_URL = "https://github.com/nbarrett/ngx-ramblers";
export const LEGACY_VERSION_PAGE_PATH = "version";
export const VERSION_PAGE_PATH = AdminPath.VERSION;

export interface DeploymentInfo {
  buildNumber: string;
  commitSha: string | null;
  commitShortSha: string | null;
  commitMessage: string | null;
  commitUrl: string | null;
  branch: string | null;
  builtAt: string | null;
  buildUrl: string | null;
  imageTag: string | null;
  repositoryUrl: string;
  environment: string;
  flyAppName: string | null;
  flyRegion: string | null;
  nodeVersion: string;
  uptimeSeconds: number;
  startedAt: string;
  serverTime: string;
}
