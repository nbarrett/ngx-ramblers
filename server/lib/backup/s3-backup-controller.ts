import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { asNumber } from "../../../projects/ngx-ramblers/src/app/functions/numbers";
import * as s3BackupService from "./s3-backup-service";

const debugLog = debug(envConfig.logNamespace("s3-backup-controller"));
debugLog.enabled = false;

export async function startBackup(req: Request, res: Response) {
  try {
    const request = req.body;
    debugLog("startS3Backup:request:", request);
    const results = await s3BackupService.startS3Backup(request);
    debugLog("startS3Backup:response:", results.length, "sites processed");
    res.status(200).json(results);
  } catch (error) {
    debugLog("startS3Backup:error:", error);
    res.status(400).json({ error: error.message });
  }
}

export async function startRestore(req: Request, res: Response) {
  try {
    const request = req.body;
    debugLog("startS3Restore:request:", request);
    const results = await s3BackupService.startS3Restore(request);
    debugLog("startS3Restore:response:", results.length, "sites processed");
    res.status(200).json(results);
  } catch (error) {
    debugLog("startS3Restore:error:", error);
    res.status(400).json({ error: error.message });
  }
}

export async function listManifests(req: Request, res: Response) {
  try {
    const site = req.query.site as string | undefined;
    const limit = asNumber(req.query.limit || 50);
    const results = await s3BackupService.manifests(site, limit);
    debugLog("listManifests:response:", results.length, "manifests");
    res.status(200).json(results);
  } catch (error) {
    debugLog("listManifests:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function manifestById(req: Request, res: Response) {
  try {
    const result = await s3BackupService.manifest(req.params.id);
    if (!result) {
      res.status(404).json({ error: "Manifest not found" });
      return;
    }
    debugLog("manifest:response:", result.site, result.timestamp);
    res.status(200).json(result);
  } catch (error) {
    debugLog("manifest:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function manifestByTimestamp(req: Request, res: Response) {
  try {
    const site = req.params.site;
    const timestamp = req.params.timestamp;
    const result = await s3BackupService.manifestByTimestamp(site, timestamp);
    if (!result) {
      res.status(404).json({ error: "Manifest not found" });
      return;
    }
    debugLog("manifestByTimestamp:response:", result.site, result.timestamp);
    res.status(200).json(result);
  } catch (error) {
    debugLog("manifestByTimestamp:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function listSites(req: Request, res: Response) {
  try {
    const sites = await s3BackupService.availableSites();
    debugLog("listSites:response:", sites.length, "sites");
    res.status(200).json(sites);
  } catch (error) {
    debugLog("listSites:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function deleteManifests(req: Request, res: Response) {
  try {
    const ids = req.body?.ids;
    if (!ids || !ids.length) {
      res.status(400).json({ error: "ids array is required" });
      return;
    }
    const result = await s3BackupService.deleteManifests(ids);
    debugLog("deleteManifests:response:", result.deleted, "deleted");
    res.status(200).json(result);
  } catch (error) {
    debugLog("deleteManifests:error:", error);
    res.status(500).json({ error: error.message });
  }
}
