import { Request, Response } from "express";
import { isArray, isString } from "es-toolkit/compat";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { isOsMapsRouteUrl, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { dispatchOsMapsExport, dispatchOsMapsList } from "../ramblers/os-maps-export-dispatcher";
import { osMapsExportResultByJobId } from "./os-maps-export-result-store";
import { latestOsMapsRouteListing } from "./os-maps-route-listing-store";
import { osMapsImportedRouteById, saveOsMapsImportedRoute } from "./os-maps-imported-route-store";

function actorNameFrom(req: Request): string {
  const user = req.user as Partial<MemberCookie> | undefined;
  return user?.firstName || user?.userName || "Walks Admin";
}

const debugLog = debug(envConfig.logNamespace("os-maps-export-controller"));
debugLog.enabled = true;

export async function listOsMapsRoutes(_req: Request, res: Response): Promise<void> {
  try {
    const listing = await latestOsMapsRouteListing();
    res.json(listing);
  } catch (error) {
    debugLog("list failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function refreshOsMapsRoutes(req: Request, res: Response): Promise<void> {
  try {
    const result = await dispatchOsMapsList(actorNameFrom(req));
    res.json(result);
  } catch (error) {
    debugLog("refresh failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function exportOsMapsRoute(req: Request, res: Response): Promise<void> {
  const routeUrls = routeUrlsFrom(req.body);
  const walkId = isString(req.body?.walkId) ? req.body.walkId : undefined;
  if (routeUrls.length === 0) {
    res.status(400).json({error: "Choose at least one OS Maps route to convert"});
  } else {
    try {
      const result = await dispatchOsMapsExport(routeUrls, walkId, actorNameFrom(req));
      res.json(result);
    } catch (error) {
      debugLog("export failed:", (error as Error).message);
      res.status(500).json({error: (error as Error).message});
    }
  }
}

export async function osMapsImportedRoute(req: Request, res: Response): Promise<void> {
  try {
    const listing = await latestOsMapsRouteListing();
    const listed = (listing.routes || []).find(route => route.id === req.params.routeId);
    const imported = await osMapsImportedRouteById(req.params.routeId);
    if (!listed && !imported) {
      res.status(404).json({error: "That OS Maps route was not found"});
    } else {
      res.json({
        id: req.params.routeId,
        title: listed?.title || imported?.url || req.params.routeId,
        url: listed?.url || imported?.url || "",
        createdAt: listed?.createdAt || "",
        createdAtValue: listed?.createdAtValue || 0,
        distanceMetres: listed?.distanceMetres || 0,
        source: listed?.source || OsMapsRouteSource.CREATED,
        importedAt: imported?.importedAt || listed?.importedAt || 0,
        gpxFile: imported?.gpxFile || listed?.gpxFile || null,
        routeColor: imported?.color || listed?.routeColor || null,
        routeWeight: imported?.weight || listed?.routeWeight || null,
        routeOpacity: imported?.opacity || listed?.routeOpacity || null
      });
    }
  } catch (error) {
    debugLog("imported route failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function updateOsMapsImportedRoute(req: Request, res: Response): Promise<void> {
  try {
    const saved = await saveOsMapsImportedRoute(req.params.routeId, {
      gpxFile: req.body?.gpxFile || undefined,
      color: req.body?.color,
      weight: req.body?.weight,
      opacity: req.body?.opacity
    });
    if (!saved) {
      res.status(404).json({error: "That imported OS Maps route was not found"});
    } else {
      res.json(saved);
    }
  } catch (error) {
    debugLog("save imported route failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function osMapsExportJobResult(req: Request, res: Response): Promise<void> {
  try {
    const result = await osMapsExportResultByJobId(req.params.jobId);
    if (!result) {
      res.status(404).json({error: "OS Maps export job was not found"});
    } else {
      res.json(result);
    }
  } catch (error) {
    debugLog("export result failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

function routeUrlsFrom(body: {routeUrl?: unknown; routeUrls?: unknown}): string[] {
  if (isArray(body?.routeUrls)) {
    return body.routeUrls.filter(url => isString(url) && isOsMapsRouteUrl(url));
  } else if (isString(body?.routeUrl) && isOsMapsRouteUrl(body.routeUrl)) {
    return [body.routeUrl];
  } else {
    return [];
  }
}
