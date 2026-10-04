import { accessibleRoutes, canEditImportedRoute, routeAdmin } from "./os-maps-route-access";
import { OsMapsAccountScope, OsMapsImportContext, RouteVisibility } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { routesWithWalkReferences } from "./os-maps-route-walks";
import { removeOsMapsRouteFromApp } from "./os-maps-route-listing-store";
import { routeContributorFrom } from "../auth/request-member";
import { Request, Response } from "express";
import { isArray, isString } from "es-toolkit/compat";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { isOsMapsRouteUrl, OsMapsExportJobResult, OsMapsExportJobStatus, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { dispatchOsMapsExport, dispatchOsMapsList } from "../ramblers/os-maps-export-dispatcher";
import { cancelActiveWorkerQueueJob } from "../ramblers/integration-worker-queue-client";
import { failOsMapsExportResult, latestOsMapsExportResult, osMapsExportResultByJobId, lastOsMapsExportActivityAt, osMapsExportResultWithActivity } from "./os-maps-export-result-store";
import { dateTimeNowAsValue } from "../shared/dates";
import { latestOsMapsRouteListing, listedImportedOsMapsRoutes } from "./os-maps-route-listing-store";
import { osMapsImportedRouteById, saveOsMapsImportedRoute } from "./os-maps-imported-route-store";

function actorNameFrom(req: Request): string {
  const user = req.user as Partial<MemberCookie> | undefined;
  return user?.firstName || user?.userName || "Walks Admin";
}

const debugLog = debug(envConfig.logNamespace("os-maps-export-controller"));
debugLog.enabled = true;

export async function listOsMapsRoutes(req: Request, res: Response): Promise<void> {
  try {
    const member = req.user as MemberCookie;
    const listing = await latestOsMapsRouteListing(accountOwner(req));
    const imported = await listedImportedOsMapsRoutes();
    const combined = [...listing.routes, ...imported.filter(route => !listing.routes.some(listed => listed.id === route.id))];
    const shown = routeAdmin(member) ? combined : combined.filter(route => !!route.importedAt || listing.routes.some(listed => listed.id === route.id));
    res.json({...listing, routes: await routesWithWalkReferences(accessibleRoutes(shown, member))});
  } catch (error) {
    debugLog("list failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function listImportedOsMapsRoutes(req: Request, res: Response): Promise<void> {
  try {
    const routes = await listedImportedOsMapsRoutes();
    res.json(accessibleRoutes(routes, req.user as MemberCookie || null));
  } catch (error) {
    debugLog("imported list failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function publicImportedOsMapsRoute(req: Request, res: Response): Promise<void> {
  try {
    const routes = accessibleRoutes(await listedImportedOsMapsRoutes(), req.user as MemberCookie || null);
    const key = req.params.routeId;
    const asNumber = /^\d+$/.test(key) ? Number(key) : null;
    const route = asNumber !== null
      ? routes.find(item => item.number === asNumber) || routes.find(item => item.id === key)
      : routes.find(item => item.id === key);
    if (!route) {
      res.status(404).json({error: "That imported route was not found"});
    } else {
      res.json(route);
    }
  } catch (error) {
    debugLog("public imported route failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function refreshOsMapsRoutes(req: Request, res: Response): Promise<void> {
  try {
    const result = await dispatchOsMapsList(actorNameFrom(req), routeContributorFrom(req), importContext(req));
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
      const member = req.user as MemberCookie;
      const listing = await latestOsMapsRouteListing(accountOwner(req));
      const available = accessibleRoutes(listing.routes, member);
      const permitted = routeAdmin(member) || (!walkId && routeUrls.every(url => available.some(route => route.url === url && !route.importedAt)));
      const latest = await latestOsMapsExportResult(routeAdmin(member) ? null : member.memberId);
      const current = latest ? await withExportActivityStatus(latest) : null;
      if (!permitted) {
        res.status(403).json({error: "Choose unimported routes from your own OS Maps account"});
      } else if (current?.status === OsMapsExportJobStatus.QUEUED) {
        res.status(409).json({error: "An OS Maps conversion is already running. Wait for it to finish or stop the current job.", jobId: current.jobId});
      } else {
        const result = await dispatchOsMapsExport(routeUrls, walkId, actorNameFrom(req), routeContributorFrom(req), importContext(req));
        res.json(result);
      }
    } catch (error) {
      debugLog("export failed:", (error as Error).message);
      res.status(500).json({error: (error as Error).message});
    }
  }
}

export async function osMapsImportedRoute(req: Request, res: Response): Promise<void> {
  try {
    const routes = accessibleRoutes(await listedImportedOsMapsRoutes(), req.user as MemberCookie);
    const route = routes.find(item => item.id === req.params.routeId);
    if (!route) {
      res.status(404).json({error: "That OS Maps route was not found"});
    } else {
      res.json(route);
    }
  } catch (error) {
    debugLog("imported route failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function updateOsMapsImportedRoute(req: Request, res: Response): Promise<void> {
  try {
    const existing = await osMapsImportedRouteById(req.params.routeId);
    const member = req.user as MemberCookie;
    if (!existing || !canEditImportedRoute(existing, member)) {
      res.status(403).json({error: "You can only edit your own routes"});
    } else {
      const visibility = req.body?.visibility;
      const route = (await listedImportedOsMapsRoutes()).find(item => item.id === req.params.routeId);
      const referenced = visibility === RouteVisibility.PRIVATE && route ? (await routesWithWalkReferences([route]))[0].walks.length > 0 : false;
      if (referenced) {
        res.status(409).json({error: "A route linked to a walk must remain shared with the group"});
      } else if (visibility && ![RouteVisibility.PRIVATE, RouteVisibility.GROUP].includes(visibility)) {
        res.status(400).json({error: "Choose private or shared with the group"});
      } else if (!routeAdmin(member) && req.body?.gpxFile?.awsFileName && req.body.gpxFile.awsFileName !== existing.gpxFile?.awsFileName) {
        res.status(403).json({error: "The route file cannot be replaced"});
      } else {
        const saved = await saveOsMapsImportedRoute(req.params.routeId, {
          ...(visibility ? {visibility} : {}),
          gpxFile: req.body?.gpxFile || null,
          color: req.body?.color,
          weight: req.body?.weight,
          opacity: req.body?.opacity
        }, routeContributorFrom(req));
        res.json(saved);
      }
    }
  } catch (error) {
    debugLog("save imported route failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

async function withExportActivityStatus(result: OsMapsExportJobResult): Promise<OsMapsExportJobResult> {
  if (result.status === OsMapsExportJobStatus.COMPLETED) {
    return result;
  } else {
    const lastActivity = await lastOsMapsExportActivityAt(result);
    return osMapsExportResultWithActivity(result, lastActivity, dateTimeNowAsValue());
  }
}

export async function osMapsExportJobResult(req: Request, res: Response): Promise<void> {
  try {
    const result = await osMapsExportResultByJobId(req.params.jobId);
    const member = req.user as MemberCookie;
    if (!result || (!routeAdmin(member) && result.contributor?.memberId !== member.memberId)) {
      res.status(404).json({error: "OS Maps export job was not found"});
    } else {
      res.json(await withExportActivityStatus(result));
    }
  } catch (error) {
    debugLog("export result failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function latestOsMapsExportJobResult(req: Request, res: Response): Promise<void> {
  try {
    const member = req.user as MemberCookie;
    const latest = await latestOsMapsExportResult(routeAdmin(member) ? null : member.memberId);
    res.json(latest ? await withExportActivityStatus(latest) : null);
  } catch (error) {
    debugLog("latest export result failed:", (error as Error).message);
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

export async function cancelOsMapsExport(_req: Request, res: Response): Promise<void> {
  try {
    const workerOutcome = await cancelActiveWorkerQueueJob().catch(error => {
      debugLog("worker cancel unavailable:", (error as Error).message);
      return {cancelled: false};
    });
    const latest = await latestOsMapsExportResult();
    const abandoned = latest?.status === OsMapsExportJobStatus.QUEUED
      ? await failOsMapsExportResult(latest.jobId, "This conversion was stopped before it finished. Try it again.")
      : null;
    res.json({cancelled: workerOutcome.cancelled || !!abandoned, jobId: abandoned?.jobId || latest?.jobId});
  } catch (error) {
    debugLog("cancel export failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

export async function deleteOsMapsRoute(req: Request, res: Response): Promise<void> {
  try {
    const listing = await latestOsMapsRouteListing();
    const importedRoutes = await listedImportedOsMapsRoutes();
    const route = listing.routes.find(item => item.id === req.params.routeId)
      || importedRoutes.find(item => item.id === req.params.routeId);
    if (!route) {
      res.status(404).json({error: "That route was not found"});
    } else {
      const [referencedRoute] = await routesWithWalkReferences([route]);
      if (!route.gpxFile?.awsFileName) {
        res.status(409).json({error: "This route has not been imported, so there is nothing to delete"});
      } else if (referencedRoute.walks.length > 0) {
        res.status(409).json({error: "This route cannot be deleted because it is linked to a walk", walks: referencedRoute.walks});
      } else {
        await removeOsMapsRouteFromApp(route.id);
        res.json({deleted: true});
      }
    }
  } catch (error) {
    debugLog("delete route failed:", (error as Error).message);
    res.status(500).json({error: (error as Error).message});
  }
}

function accountOwner(req: Request): string | null {
  const member = req.user as MemberCookie;
  return !routeAdmin(member) || req.body?.account === OsMapsAccountScope.PERSONAL || req.query?.account === OsMapsAccountScope.PERSONAL ? member.memberId : null;
}

function importContext(req: Request): OsMapsImportContext {
  const owner = accountOwner(req);
  return owner ? {ownerMemberId: owner, accountOwnerId: owner,
    visibility: req.body?.visibility === RouteVisibility.GROUP ? RouteVisibility.GROUP : RouteVisibility.PRIVATE}
    : {ownerMemberId: (req.user as MemberCookie).memberId, visibility: RouteVisibility.GROUP};
}
