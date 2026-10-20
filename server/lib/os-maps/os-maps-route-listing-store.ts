import { OsMapsImportedRouteRecord, osMapsImportedRoute } from "../mongo/models/os-maps-imported-route";
import { dateTimeNowAsValue } from "../shared/dates";
import { osMapsRouteListing } from "../mongo/models/os-maps-route-listing";
import { OsMapsListedRoute, OsMapsRouteListing, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import * as mongooseClient from "../mongo/mongoose-client";
import { values } from "es-toolkit/compat";
import { importedRecordsByRouteId, withImportedAt } from "./os-maps-imported-route-store";

const LISTING_KEY = "latest";

export async function saveOsMapsRouteListing(routes: OsMapsListedRoute[], ownerMemberId: string | null = null): Promise<OsMapsRouteListing> {
  const listedAt = dateTimeNowAsValue();
  const importedById = await importedRecordsByRouteId();
  const merged = withImportedAt(routes, importedById);
  const slim = merged.map(route => ({...route, waypoints: null, walks: undefined}));
  return mongooseClient.execute(() => osMapsRouteListing.findOneAndUpdate(
    {key: ownerMemberId || LISTING_KEY},
    {key: ownerMemberId || LISTING_KEY, listedAt, routes: slim},
    {upsert: true, new: true, lean: true}
  ).then(document => ({
    listedAt: document?.listedAt || listedAt,
    routes: withImportedAt(document?.routes || slim, importedById)
  })));
}

const LISTING_ROUTE_FIELDS = "listedAt routes.id routes.title routes.url routes.createdAt routes.createdAtValue routes.distanceMetres routes.source routes.importedAt routes.number routes.ownerMemberId routes.visibility";

export async function latestOsMapsRouteListing(ownerMemberId: string | null = null, importedById?: Record<string, OsMapsImportedRouteRecord>): Promise<OsMapsRouteListing> {
  const imported = importedById || await importedRecordsByRouteId();
  return mongooseClient.execute(() => osMapsRouteListing.findOne({key: ownerMemberId || LISTING_KEY}).select(LISTING_ROUTE_FIELDS).lean()
    .then(document => ({
      listedAt: document?.listedAt || 0,
      routes: withImportedAt(document?.routes || [], imported)
    })));
}

export function listedImportedFrom(listing: OsMapsRouteListing, importedById: Record<string, OsMapsImportedRouteRecord>): OsMapsListedRoute[] {
  const fromListing = (listing.routes || []).filter(route => !!route.gpxFile?.awsFileName);
  const listedIds = new Set(fromListing.map(route => route.id));
  const extras = values(importedById)
    .filter(record => record.gpxFile?.awsFileName && !listedIds.has(record.routeId))
    .map(listedRouteFromImportedRecord);
  return [...fromListing, ...extras].sort((left, right) => (right.importedAt || 0) - (left.importedAt || 0));
}

export async function listedImportedOsMapsRoutes(): Promise<OsMapsListedRoute[]> {
  const importedById = await importedRecordsByRouteId();
  const listing = await latestOsMapsRouteListing(null, importedById);
  return listedImportedFrom(listing, importedById);
}

export function listedRouteFromImportedRecord(record: OsMapsImportedRouteRecord): OsMapsListedRoute {
  return {
    id: record.routeId,
    ownerMemberId: record.ownerMemberId || null,
    visibility: record.visibility || null,
    number: record.number || null,
    title: record.gpxFile?.title || record.url || record.routeId,
    url: record.url || "",
    createdAt: "",
    createdAtValue: record.gpxFile?.walkedAt || record.importedAt || 0,
    distanceMetres: record.gpxFile?.distanceMetres || 0,
    source: OsMapsRouteSource.CREATED,
    importedAt: record.importedAt,
    gpxFile: record.gpxFile,
    routeColor: record.color,
    routeWeight: record.weight,
    routeOpacity: record.opacity,
    walkedAt: record.gpxFile?.walkedAt || null,
    walkedByName: record.gpxFile?.walkedByName || null,
    difficulty: record.difficulty || null
  };
}

export function importedOsMapsListingRoutes(routes: OsMapsListedRoute[]): OsMapsListedRoute[] {
  return (routes || []).filter(route => !!route.importedAt);
}

export async function clearUnimportedOsMapsListing(ownerMemberId: string | null = null): Promise<{cleared: number; remaining: number}> {
  const key = ownerMemberId || LISTING_KEY;
  return mongooseClient.execute(async () => {
    const document = await osMapsRouteListing.findOne({key}).lean();
    const routes = document?.routes || [];
    const kept = importedOsMapsListingRoutes(routes);
    const cleared = routes.length - kept.length;
    if (cleared > 0) {
      await osMapsRouteListing.updateOne({key}, {$set: {routes: kept}});
    }
    return {cleared, remaining: kept.length};
  });
}

export async function removeOsMapsRouteFromApp(routeId: string): Promise<void> {
  await mongooseClient.execute(async () => {
    await osMapsRouteListing.updateMany({}, {$pull: {routes: {id: routeId}}});
    await osMapsImportedRoute.deleteOne({routeId});
  });
}
