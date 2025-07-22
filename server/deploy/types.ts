export interface EnvironmentConfig {
  name: string;
  apiKey: string;
  appName: string;
  memory: string;
  scaleCount: number;
  organization: string;
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

export interface SecretsConfig {
  [key: string]: string;
}
