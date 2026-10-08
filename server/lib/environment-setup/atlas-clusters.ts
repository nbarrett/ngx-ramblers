import debug from "debug";
import { MongoClient } from "mongodb";
import { envConfig } from "../env-config/env-config";
import * as configController from "../mongo/controllers/config";
import { configuredEnvironments } from "../environments/environments-config";
import { registrationSettings } from "../site-registration/registration-store";
import { buildMongoUri, extractClusterFromUri } from "../shared/mongodb-uri";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  AtlasAwsRegion,
  AtlasClusterCreateRequest,
  AtlasClusterEnvironmentRow,
  AtlasClusterRow,
  AtlasClusterState,
  AtlasClusterTier,
  AtlasClusterView,
  AtlasNetworkAccessEntry,
  atlasTierFromInstanceSize,
  clusterCapacity
} from "../../../projects/ngx-ramblers/src/app/models/atlas-cluster.model";
import { AtlasConfig, EnvironmentsConfig, MongoConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { atlasRequest } from "./atlas-admin-api";
import { AtlasApiAccess, AtlasError } from "./atlas-admin-api.model";
import { platformAtlasAccess } from "./mongo-database-user";

const debugLog = debug(envConfig.logNamespace("atlas-clusters"));
debugLog.enabled = true;

interface AtlasClusterDescription {
  name?: string;
  stateName?: string;
  connectionStrings?: {standardSrv?: string};
  replicationSpecs?: {regionConfigs?: {electableSpecs?: {instanceSize?: string}; providerName?: string; backingProviderName?: string; regionName?: string}[]}[];
}

interface AtlasClusterList {
  results?: AtlasClusterDescription[];
}

interface AtlasAccessList {
  results?: {cidrBlock?: string; ipAddress?: string; comment?: string}[];
}

export function clusterHostFromSrv(standardSrv: string): string {
  const withUser = extractClusterFromUri(standardSrv);
  if (withUser) {
    return withUser;
  } else {
    const match = (standardSrv || "").match(/mongodb\+srv:\/\/([^/?]+)/i);
    const host = match?.[1] || "";
    return host.replace(/\.mongodb\.net$/i, "");
  }
}

export function atlasClusterCreateBody(name: string, tier: AtlasClusterTier, region: AtlasAwsRegion): Record<string, unknown> {
  const tenant = tier === AtlasClusterTier.M0 || tier === AtlasClusterTier.FLEX;
  return {
    name,
    clusterType: "REPLICASET",
    replicationSpecs: [{
      regionConfigs: [{
        electableSpecs: tenant ? {instanceSize: tier} : {instanceSize: tier, nodeCount: 3},
        providerName: tenant ? "TENANT" : "AWS",
        ...(tenant ? {backingProviderName: "AWS"} : {}),
        regionName: region,
        priority: 7
      }]
    }]
  };
}

function atlasStateFrom(stateName: string | undefined): AtlasClusterState {
  const state = (stateName || "").toUpperCase();
  if (state === AtlasClusterState.IDLE) {
    return AtlasClusterState.IDLE;
  } else if (state === AtlasClusterState.CREATING) {
    return AtlasClusterState.CREATING;
  } else if (state === AtlasClusterState.UPDATING) {
    return AtlasClusterState.UPDATING;
  } else if (state === AtlasClusterState.REPAIRING) {
    return AtlasClusterState.REPAIRING;
  } else if (state === AtlasClusterState.DELETING) {
    return AtlasClusterState.DELETING;
  } else if (state === AtlasClusterState.DELETED) {
    return AtlasClusterState.DELETED;
  } else {
    return AtlasClusterState.UNKNOWN;
  }
}

function instanceSizeFrom(cluster: AtlasClusterDescription): AtlasClusterTier {
  const region = cluster.replicationSpecs?.[0]?.regionConfigs?.[0];
  return atlasTierFromInstanceSize(region?.electableSpecs?.instanceSize);
}

function regionFrom(cluster: AtlasClusterDescription): string {
  return cluster.replicationSpecs?.[0]?.regionConfigs?.[0]?.regionName || "";
}

async function countDatabaseUsage(mongo: MongoConfig): Promise<{collections: number; indexes: number}> {
  const client = new MongoClient(buildMongoUri({
    cluster: mongo.cluster,
    username: mongo.username,
    password: mongo.password,
    database: mongo.db
  }), {serverSelectionTimeoutMS: 12000, connectTimeoutMS: 12000});
  try {
    await client.connect();
    const database = client.db(mongo.db);
    const collections = await database.listCollections().toArray();
    const indexCounts = await Promise.all(collections.map(collection =>
      database.collection(collection.name).indexes().then(indexes => indexes.length).catch(() => 0)));
    return {collections: collections.length, indexes: indexCounts.reduce((total, count) => total + count, 0)};
  } finally {
    await client.close();
  }
}

async function environmentRows(config: EnvironmentsConfig): Promise<AtlasClusterEnvironmentRow[]> {
  const environments = config.environments || [];
  return Promise.all(environments.map(async environment => {
    const mongo = environment.mongo || {};
    const row: AtlasClusterEnvironmentRow = {
      environment: environment.environment,
      cluster: mongo.cluster || "",
      database: mongo.db || "",
      username: mongo.username || "",
      collections: null,
      indexes: null,
      error: null
    };
    if (!mongo.cluster || !mongo.db || !mongo.username || !mongo.password) {
      row.error = "MongoDB configuration is incomplete";
      return row;
    } else {
      try {
        const usage = await countDatabaseUsage(mongo);
        row.collections = usage.collections;
        row.indexes = usage.indexes;
        return row;
      } catch (error) {
        row.error = error?.message || "Could not count collections";
        return row;
      }
    }
  }));
}

function rollupClusters(
  atlasClusters: AtlasClusterDescription[],
  rows: AtlasClusterEnvironmentRow[],
  defaultCluster: string
): AtlasClusterRow[] {
  const byHost = new Map<string, AtlasClusterRow>();
  atlasClusters.forEach(cluster => {
    const host = clusterHostFromSrv(cluster.connectionStrings?.standardSrv || "") || cluster.name || "";
    if (host) {
      byHost.set(host, {
        name: cluster.name || host,
        host,
        instanceSize: instanceSizeFrom(cluster),
        region: regionFrom(cluster),
        stateName: atlasStateFrom(cluster.stateName),
        inProvisioningProject: true,
        isDefault: host === defaultCluster,
        environmentCount: 0,
        collectionCount: 0,
        indexCount: 0,
        databaseCount: 0,
        canAddEnvironment: true,
        limitHeadline: ""
      });
    }
  });
  rows.forEach(row => {
    if (row.cluster) {
      const existing = byHost.get(row.cluster);
      if (existing) {
        existing.environmentCount += 1;
        existing.databaseCount += row.database ? 1 : 0;
        existing.collectionCount += row.collections || 0;
        existing.indexCount += row.indexes || 0;
      } else {
        byHost.set(row.cluster, {
          name: row.cluster,
          host: row.cluster,
          instanceSize: AtlasClusterTier.UNKNOWN,
          region: "",
          stateName: AtlasClusterState.UNKNOWN,
          inProvisioningProject: false,
          isDefault: row.cluster === defaultCluster,
          environmentCount: 1,
          collectionCount: row.collections || 0,
          indexCount: row.indexes || 0,
          databaseCount: row.database ? 1 : 0,
          canAddEnvironment: true,
          limitHeadline: ""
        });
      }
    }
  });
  return Array.from(byHost.values()).map(cluster => {
    const capacity = clusterCapacity(cluster.instanceSize, cluster.collectionCount, cluster.indexCount, cluster.databaseCount);
    return {...cluster, canAddEnvironment: capacity.canAdd, limitHeadline: capacity.headline};
  }).sort((left, right) => left.host.localeCompare(right.host));
}

export async function atlasClusterView(): Promise<AtlasClusterView> {
  const config = await configuredEnvironments();
  const settings = await registrationSettings();
  const atlas = await platformAtlasAccess();
  const keysConfigured = !!(atlas.publicKey && atlas.privateKey);
  const projectId = atlas.projectId || "";
  const defaultCluster = config.atlas?.defaultCluster || "";
  const rows = await environmentRows(config);
  const atlasState: {clusters: AtlasClusterDescription[]; networkAccess: AtlasNetworkAccessEntry[]; reachable: boolean; error: string | null} = {
    clusters: [],
    networkAccess: [],
    reachable: false,
    error: null
  };
  if (!projectId || !keysConfigured) {
    atlasState.error = "Add the Atlas project ID and API keys, then you can create clusters in this project.";
  } else {
    const listed = await atlasRequest<AtlasClusterList & AtlasError>(atlas, "GET", `/groups/${projectId}/clusters?itemsPerPage=100`);
    if (listed.status >= 300) {
      atlasState.error = listed.body?.detail || listed.body?.reason || `Atlas returned ${listed.status}`;
    } else {
      atlasState.reachable = true;
      atlasState.clusters = listed.body?.results || [];
      const access = await atlasRequest<AtlasAccessList & AtlasError>(atlas, "GET", `/groups/${projectId}/accessList?itemsPerPage=100`);
      if (access.status < 300) {
        atlasState.networkAccess = (access.body?.results || []).map(entry => ({
          cidr: entry.cidrBlock || (entry.ipAddress ? `${entry.ipAddress}/32` : ""),
          comment: entry.comment || ""
        }));
      }
    }
  }
  const clusters = rollupClusters(atlasState.clusters, rows, defaultCluster);
  const template = (config.environments || []).find(environment => environment.environment === settings.sourceEnvironmentName);
  const registrationCluster = defaultCluster || template?.mongo?.cluster || "";
  const registration = clusters.find(cluster => cluster.host === registrationCluster);
  const registrationBlocked = !!registration && !registration.canAddEnvironment;
  return {
    projectId,
    defaultCluster,
    keysConfigured,
    atlasReachable: atlasState.reachable,
    atlasError: atlasState.error,
    networkAccess: atlasState.networkAccess,
    clusters,
    environments: rows.sort((left, right) => left.environment.localeCompare(right.environment)),
    registrationCluster,
    registrationBlocked,
    registrationBlockReason: registrationBlocked ? registration.limitHeadline : null
  };
}

export async function assertClusterHasCapacityForNewEnvironment(cluster: string): Promise<void> {
  const view = await atlasClusterView();
  const row = view.clusters.find(candidate => candidate.host === cluster);
  if (!cluster) {
    throw new Error("No MongoDB cluster is set for new sites. Open Environment management → MongoDB Atlas, create a cluster, and set it as the default for new sites.");
  } else if (row && !row.canAddEnvironment) {
    throw new Error(`${row.limitHeadline} Open Environment management → MongoDB Atlas and create a cluster for new sites.`);
  } else if (!row) {
    debugLog("capacity: cluster %s is not in the occupancy list; allowing create", cluster);
  }
}

export async function saveAtlasProvisioning(patch: Partial<AtlasConfig>): Promise<AtlasConfig> {
  const document = await configController.queryKey(ConfigKey.ENVIRONMENTS);
  const current: EnvironmentsConfig = document?.value || {environments: []};
  const atlas: AtlasConfig = {...(current.atlas || {})};
  if (patch.projectId !== undefined) {
    atlas.projectId = patch.projectId;
  }
  if (patch.defaultCluster !== undefined) {
    atlas.defaultCluster = patch.defaultCluster;
  }
  await configController.createOrUpdateKey(ConfigKey.ENVIRONMENTS, {...current, atlas});
  return atlas;
}

function atlasFailure(action: string, status: number, error: AtlasError | null): Error {
  return new Error(`MongoDB Atlas would not ${action} (${status}${error?.errorCode ? ` ${error.errorCode}` : ""}): ${error?.detail || error?.reason || "no detail given"}`);
}

export async function createAtlasCluster(request: AtlasClusterCreateRequest): Promise<{cluster: AtlasClusterRow | null; message: string}> {
  const atlas = await platformAtlasAccess();
  if (!atlas.projectId) {
    throw new Error("Add the Atlas project ID under Environment management → MongoDB Atlas before creating a cluster.");
  } else if (!atlas.publicKey || !atlas.privateKey) {
    throw new Error("Add the Atlas API keys under Environment management → Global settings → MongoDB Atlas before creating a cluster.");
  } else if (!request?.name?.trim()) {
    throw new Error("Enter a cluster name. Use letters, numbers and hyphens only.");
  } else if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(request.name.trim())) {
    throw new Error("Cluster names must start with a letter or number, use only letters, numbers and hyphens, and be at most 64 characters.");
  } else if (![AtlasClusterTier.M0, AtlasClusterTier.M10, AtlasClusterTier.M20, AtlasClusterTier.M30].includes(request.tier)) {
    throw new Error("Choose M0, M10, M20 or M30.");
  } else {
    const name = request.name.trim();
    const region = request.region || AtlasAwsRegion.EU_WEST_2;
    const created = await atlasRequest<AtlasClusterDescription & AtlasError>(
      atlas,
      "POST",
      `/groups/${atlas.projectId}/clusters`,
      atlasClusterCreateBody(name, request.tier, region)
    );
    if (created.status >= 300) {
      throw atlasFailure("create the cluster", created.status, created.body);
    } else {
      if (request.allowAllNetworkAccess) {
        await allowAllAtlasNetworkAccess(atlas);
      }
      const host = clusterHostFromSrv(created.body?.connectionStrings?.standardSrv || "");
      if (request.setAsDefault && host) {
        await saveAtlasProvisioning({defaultCluster: host});
      }
      const view = await atlasClusterView();
      const cluster = view.clusters.find(candidate => candidate.name === name || candidate.host === host) || null;
      const waiting = created.body?.stateName && created.body.stateName !== AtlasClusterState.IDLE
        ? " Atlas is still building it; refresh this page until the state is idle, then set it as the default for new sites if you have not already."
        : "";
      return {cluster, message: `Cluster ${name} has been requested.${waiting}`};
    }
  }
}

async function allowAllAtlasNetworkAccess(atlas: AtlasApiAccess): Promise<void> {
  const created = await atlasRequest<AtlasError>(atlas, "POST", `/groups/${atlas.projectId}/accessList`, [{
    cidrBlock: "0.0.0.0/0",
    comment: "NGX Fly apps and operators"
  }]);
  if (created.status >= 300 && created.status !== 409) {
    throw atlasFailure("add network access", created.status, created.body);
  }
}

export async function allowAtlasNetworkAccess(): Promise<{message: string}> {
  const atlas = await platformAtlasAccess();
  if (!atlas.projectId || !atlas.publicKey || !atlas.privateKey) {
    throw new Error("Add the Atlas project ID and API keys before changing network access.");
  } else {
    await allowAllAtlasNetworkAccess(atlas);
    return {message: "Atlas will now accept connections from Fly and from this app. You can tighten this later if you add a private network."};
  }
}

export function registrationMongoCluster(config: EnvironmentsConfig, templateCluster: string): string {
  return config.atlas?.defaultCluster || templateCluster || "";
}
