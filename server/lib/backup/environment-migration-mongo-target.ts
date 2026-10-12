import { generateUid } from "../../../projects/ngx-ramblers/src/app/functions/numbers";
import { Request, Response } from "express";
import { configuredEnvironments } from "../environments/environments-config";
import { atlasClusterView } from "../environment-setup/atlas-clusters";
import { createEnvironmentMongoUser, platformAtlasAccess } from "../environment-setup/mongo-database-user";
import { AtlasClusterState } from "../../../projects/ngx-ramblers/src/app/models/atlas-cluster.model";
import { EnvironmentMigrationMongoProvisionRequest, EnvironmentMigrationMongoTarget } from "../../../projects/ngx-ramblers/src/app/models/environment-migration.model";
import { createErrorDebugLog } from "../shared/error-debug-log";

const errorDebugLog = createErrorDebugLog("environment-migration-mongo-target");

export async function provisionMigrationMongoTarget(request: EnvironmentMigrationMongoProvisionRequest): Promise<EnvironmentMigrationMongoTarget> {
  const config = await configuredEnvironments();
  const source = config.environments?.find(environment => environment.environment === request.environment);
  if (!source?.mongo?.db || !source.mongo.cluster) {
    throw new Error("Select an environment with a configured MongoDB database.");
  } else if (!request.cluster || request.cluster === source.mongo.cluster) {
    throw new Error("Choose a target cluster different from the source cluster.");
  } else {
    const view = await atlasClusterView();
    const target = view.clusters.find(cluster => cluster.host === request.cluster && cluster.inProvisioningProject);
    if (!view.atlasReachable || !target) {
      throw new Error("Choose a target cluster in the configured Atlas project.");
    } else if (target.stateName !== AtlasClusterState.IDLE) {
      throw new Error("Wait until the target Atlas cluster is idle before creating a database user.");
    } else if (!target.canAddEnvironment) {
      throw new Error(target.limitHeadline);
    } else {
      const atlas = await platformAtlasAccess();
      const created = await createEnvironmentMongoUser({...atlas, projectId: target.projectId || atlas.projectId}, source.mongo.db, `${request.environment}_migration_${generateUid()}`, false);
      return {cluster: target.host, db: source.mongo.db, ...created};
    }
  }
}

export async function provisionMigrationMongoTargetRequest(req: Request, res: Response): Promise<void> {
  try {
    const target = await provisionMigrationMongoTarget({environment: req.body?.environment, cluster: req.body?.cluster});
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json(target);
  } catch (error) {
    errorDebugLog("provisionMigrationMongoTarget:", error?.message || error);
    res.status(400).json({error: error?.message || "Could not create the migration database user"});
  }
}
