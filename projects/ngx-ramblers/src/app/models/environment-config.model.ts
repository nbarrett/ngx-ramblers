export interface AwsConfig {
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface MongoConfig {
  cluster?: string;
  db?: string;
  username?: string;
  password?: string;
}

export interface FlyioConfig {
  apiKey?: string;
  appName?: string;
  memory?: string;
  scaleCount?: number;
  organisation?: string;
}

export interface EnvironmentConfig {
  environment: string;
  aws?: AwsConfig;
  mongo?: MongoConfig;
  flyio?: FlyioConfig;
  secrets?: Record<string, string>;
}

export interface EnvironmentsConfig {
  environments?: EnvironmentConfig[];
  aws?: AwsConfig;
  secrets?: Record<string, string>;
}

export const FLYIO_DEFAULTS = {
  MEMORY: "512mb",
  SCALE_COUNT: 1,
  ORGANISATION: "personal"
} as const;

export const AWS_DEFAULTS = {
  REGION: "eu-west-2"
} as const;

export function createEmptyAwsConfig(): AwsConfig {
  return {
    bucket: "",
    region: AWS_DEFAULTS.REGION,
    accessKeyId: "",
    secretAccessKey: ""
  };
}

export function createEmptyMongoConfig(): MongoConfig {
  return {
    cluster: "",
    db: "",
    username: "",
    password: ""
  };
}

export function createDefaultFlyioConfig(): FlyioConfig {
  return {
    apiKey: "",
    appName: "",
    memory: FLYIO_DEFAULTS.MEMORY,
    scaleCount: FLYIO_DEFAULTS.SCALE_COUNT,
    organisation: ""
  };
}

export function createEmptyEnvironmentConfig(): EnvironmentConfig {
  return {
    environment: "",
    aws: createEmptyAwsConfig(),
    mongo: createEmptyMongoConfig(),
    flyio: createDefaultFlyioConfig(),
    secrets: {}
  };
}
