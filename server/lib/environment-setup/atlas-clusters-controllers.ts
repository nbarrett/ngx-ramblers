import { Request, Response } from "express";
import { createErrorDebugLog } from "../shared/error-debug-log";
import {
  allowAtlasNetworkAccess,
  atlasClusterView,
  createAtlasCluster,
  saveAtlasProvisioning
} from "./atlas-clusters";
import { AtlasAwsRegion, AtlasClusterCreateRequest, AtlasClusterTier } from "../../../projects/ngx-ramblers/src/app/models/atlas-cluster.model";
import { AtlasConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";

const errorDebugLog = createErrorDebugLog("atlas-clusters-controllers");

export async function listAtlasClusters(_req: Request, res: Response): Promise<void> {
  try {
    const view = await atlasClusterView();
    res.json(view);
  } catch (error) {
    errorDebugLog("listAtlasClusters:", error?.message || error);
    res.status(500).json({error: error?.message || "Could not list Atlas clusters"});
  }
}

export async function createAtlasClusterRequest(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body || {};
    const request: AtlasClusterCreateRequest = {
      name: body.name,
      tier: body.tier || AtlasClusterTier.M0,
      region: body.region || AtlasAwsRegion.EU_WEST_2,
      setAsDefault: body.setAsDefault === true,
      allowAllNetworkAccess: body.allowAllNetworkAccess !== false
    };
    const result = await createAtlasCluster(request);
    res.status(201).json(result);
  } catch (error) {
    errorDebugLog("createAtlasCluster:", error?.message || error);
    res.status(400).json({error: error?.message || "Could not create the cluster"});
  }
}

export async function allowAtlasNetworkAccessRequest(_req: Request, res: Response): Promise<void> {
  try {
    const result = await allowAtlasNetworkAccess();
    res.json(result);
  } catch (error) {
    errorDebugLog("allowAtlasNetworkAccess:", error?.message || error);
    res.status(400).json({error: error?.message || "Could not update network access"});
  }
}

export async function saveAtlasProvisioningRequest(req: Request, res: Response): Promise<void> {
  try {
    const patch: Partial<AtlasConfig> = {};
    if (req.body?.projectId !== undefined) {
      patch.projectId = req.body.projectId;
    }
    if (req.body?.defaultCluster !== undefined) {
      patch.defaultCluster = req.body.defaultCluster;
    }
    const atlas = await saveAtlasProvisioning(patch);
    res.json({atlas});
  } catch (error) {
    errorDebugLog("saveAtlasProvisioning:", error?.message || error);
    res.status(400).json({error: error?.message || "Could not save Atlas settings"});
  }
}
