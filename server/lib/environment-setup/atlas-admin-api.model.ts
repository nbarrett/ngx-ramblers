export enum AtlasApiVersion {
  DEFAULT = "2023-01-01",
  CLUSTERS = "2023-02-01"
}

export interface AtlasApiAccess {
  projectId?: string;
  publicKey?: string;
  privateKey?: string;
}

export interface CreatedEnvironmentMongoUser {
  username: string;
  password: string;
}

export interface AtlasResponse<T> {
  status: number;
  body: T | null;
}

export interface AtlasError {
  errorCode?: string;
  detail?: string;
  reason?: string;
}

export interface AtlasProjectDescription {
  id?: string;
  name?: string;
  orgId?: string;
}

export interface AtlasClusterDescription {
  groupId?: string;
  name?: string;
  stateName?: string;
  connectionStrings?: {standardSrv?: string};
  replicationSpecs?: {regionConfigs?: {electableSpecs?: {instanceSize?: string}; providerName?: string; backingProviderName?: string; regionName?: string}[]}[];
}

export interface AtlasClusterList {
  results?: AtlasClusterDescription[];
}

export interface AtlasAccessList {
  results?: {cidrBlock?: string; ipAddress?: string; comment?: string}[];
}
