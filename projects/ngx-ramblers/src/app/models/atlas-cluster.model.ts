export enum AtlasClusterTier {
  M0 = "M0",
  M10 = "M10",
  M20 = "M20",
  M30 = "M30",
  FLEX = "FLEX",
  UNKNOWN = "UNKNOWN"
}

export enum AtlasAwsRegion {
  EU_WEST_2 = "EU_WEST_2"
}

export enum AtlasClusterState {
  IDLE = "IDLE",
  CREATING = "CREATING",
  UPDATING = "UPDATING",
  REPAIRING = "REPAIRING",
  DELETING = "DELETING",
  DELETED = "DELETED",
  UNKNOWN = "UNKNOWN"
}

export const ATLAS_M0_MAX_COLLECTIONS = 500;
export const ATLAS_M0_MAX_DATABASES = 100;
export const NEW_ENVIRONMENT_COLLECTION_HEADROOM = 80;
export const NEW_ENVIRONMENT_INDEX_HEADROOM = 160;
export const ATLAS_CLUSTER_BUSY_DATABASE_COUNT = 6;

export const ATLAS_RECOMMENDED_COLLECTION_AND_INDEX_LIMIT: Record<AtlasClusterTier, number | null> = {
  [AtlasClusterTier.M0]: null,
  [AtlasClusterTier.FLEX]: null,
  [AtlasClusterTier.M10]: 5000,
  [AtlasClusterTier.M20]: 10000,
  [AtlasClusterTier.M30]: 10000,
  [AtlasClusterTier.UNKNOWN]: null
};

export interface AtlasNetworkAccessEntry {
  cidr: string;
  comment: string;
}

export interface AtlasClusterEnvironmentRow {
  environment: string;
  cluster: string;
  database: string;
  username: string;
  collections: number | null;
  indexes: number | null;
  error: string | null;
}

export interface AtlasClusterRow {
  name: string;
  host: string;
  instanceSize: AtlasClusterTier;
  region: string;
  stateName: AtlasClusterState;
  inProvisioningProject: boolean;
  isDefault: boolean;
  environmentCount: number;
  collectionCount: number;
  indexCount: number;
  databaseCount: number;
  canAddEnvironment: boolean;
  limitHeadline: string;
}

export interface AtlasClusterView {
  projectId: string;
  defaultCluster: string;
  keysConfigured: boolean;
  atlasReachable: boolean;
  atlasError: string | null;
  networkAccess: AtlasNetworkAccessEntry[];
  clusters: AtlasClusterRow[];
  environments: AtlasClusterEnvironmentRow[];
  registrationCluster: string;
  registrationBlocked: boolean;
  registrationBlockReason: string | null;
}

export interface AtlasClusterCreateRequest {
  name: string;
  tier: AtlasClusterTier;
  region: AtlasAwsRegion;
  setAsDefault: boolean;
  allowAllNetworkAccess: boolean;
}

export function atlasTierFromInstanceSize(instanceSize: string | null | undefined): AtlasClusterTier {
  const size = (instanceSize || "").toUpperCase();
  if (size === AtlasClusterTier.M0) {
    return AtlasClusterTier.M0;
  } else if (size === AtlasClusterTier.M10) {
    return AtlasClusterTier.M10;
  } else if (size === AtlasClusterTier.M20) {
    return AtlasClusterTier.M20;
  } else if (size === AtlasClusterTier.M30) {
    return AtlasClusterTier.M30;
  } else if (size === AtlasClusterTier.FLEX || size === "M2" || size === "M5") {
    return AtlasClusterTier.FLEX;
  } else {
    return AtlasClusterTier.UNKNOWN;
  }
}

export function clusterCapacity(instanceSize: AtlasClusterTier, collections: number, indexes: number, databases: number): {canAdd: boolean; headline: string} {
  const nextCollections = collections + NEW_ENVIRONMENT_COLLECTION_HEADROOM;
  const nextCombined = collections + indexes + NEW_ENVIRONMENT_COLLECTION_HEADROOM + NEW_ENVIRONMENT_INDEX_HEADROOM;
  const recommended = ATLAS_RECOMMENDED_COLLECTION_AND_INDEX_LIMIT[instanceSize];
  if (instanceSize === AtlasClusterTier.M0 || instanceSize === AtlasClusterTier.FLEX) {
    if (databases >= ATLAS_M0_MAX_DATABASES) {
      return {canAdd: false, headline: `Free clusters allow ${ATLAS_M0_MAX_DATABASES} databases. Create another cluster before adding a site.`};
    } else if (nextCollections > ATLAS_M0_MAX_COLLECTIONS) {
      return {canAdd: false, headline: `Free clusters allow ${ATLAS_M0_MAX_COLLECTIONS} collections in total. This cluster has ${collections}, and a new site needs about ${NEW_ENVIRONMENT_COLLECTION_HEADROOM} more. Create another cluster.`};
    } else {
      return {canAdd: true, headline: `${collections} of ${ATLAS_M0_MAX_COLLECTIONS} collections used. A new site needs about ${NEW_ENVIRONMENT_COLLECTION_HEADROOM}.`};
    }
  } else if (recommended) {
    if (nextCombined > recommended) {
      return {canAdd: false, headline: `${instanceSize} is rated for about ${recommended} collections and indexes together. This cluster has ${collections + indexes}. Create another cluster.`};
    } else {
      return {canAdd: true, headline: `${collections + indexes} of about ${recommended} collections and indexes used.`};
    }
  } else if (nextCollections > ATLAS_M0_MAX_COLLECTIONS) {
    return {canAdd: false, headline: `This cluster already has ${collections} collections. Free Atlas clusters stop at ${ATLAS_M0_MAX_COLLECTIONS}. Create another cluster before adding a site.`};
  } else {
    return {canAdd: true, headline: `${collections} collections on this cluster.`};
  }
}
