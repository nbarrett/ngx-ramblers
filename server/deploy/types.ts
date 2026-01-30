export interface SecretsConfig {
  [key: string]: string;
}

export const FLYIO_DEFAULTS = {
  MEMORY: "512mb",
  SCALE_COUNT: 1,
  ORGANISATION: "personal"
} as const;

export const AWS_DEFAULTS = {
  REGION: "eu-west-2"
} as const;

export interface MongoConfig {
  cluster: string;
  db: string;
  username: string;
  password: string;
}

export interface EnvironmentConfig {
  name: string;
  apiKey: string;
  appName: string;
  memory: string;
  scaleCount: number;
  organisation: string;
  mongo?: MongoConfig;
}

export interface NewEnvironmentConfig extends EnvironmentConfig {
  secrets: SecretsConfig;
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

export interface VolumeInformation {
  id: string;
  region: string;
  attachedVM: string;
  reachable: boolean;
}

export interface BackupOptions {
  env: string;
  db?: string;
  collections?: string;
  scaleDown: boolean;
  upload: boolean;
}

export interface RestoreOptions {
  env: string;
  from: string;
  db?: string;
  collections?: string;
  drop: boolean;
  dryRun: boolean;
}

export enum PackageManager {
  NPM = "npm",
  PNPM = "pnpm"
}
