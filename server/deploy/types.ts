export interface SecretsConfig {
  [key: string]: string;
}

export interface MongoConfig {
  uri: string;
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
  organization: string;
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
