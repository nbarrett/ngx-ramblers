import { dateTimeNowAsValue } from "../shared/dates";
import { osMapsRouteListing } from "../mongo/models/os-maps-route-listing";
import { OsMapsListedRoute, OsMapsRouteListing, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import * as mongooseClient from "../mongo/mongoose-client";
import { values } from "es-toolkit/compat";
import { importedRecordsByRouteId, withImportedAt } from "./os-maps-imported-route-store";

const LISTING_KEY = "latest";

export async function saveOsMapsRouteListing(routes: OsMapsListedRoute[]): Promise<OsMapsRouteListing> {
  const listedAt = dateTimeNowAsValue();
  const importedById = await importedRecordsByRouteId();
  const merged = withImportedAt(routes, importedById);
  return mongooseClient.execute(() => osMapsRouteListing.findOneAndUpdate(
    {key: LISTING_KEY},
    {key: LISTING_KEY, listedAt, routes: merged},
    {upsert: true, new: true, lean: true}
  ).then(document => ({
    listedAt: document?.listedAt || listedAt,
    routes: withImportedAt(document?.routes || merged, importedById)
  })));
}

export async function latestOsMapsRouteListing(): Promise<OsMapsRouteListing> {
  const importedById = await importedRecordsByRouteId();
  return mongooseClient.execute(() => osMapsRouteListing.findOne({key: LISTING_KEY}).lean()
    .then(document => ({
      listedAt: document?.listedAt || 0,
      routes: withImportedAt(document?.routes || [], importedById)
    })));
}

export async function listedImportedOsMapsRoutes(): Promise<OsMapsListedRoute[]> {
  const listing = await latestOsMapsRouteListing();
  const importedById = await importedRecordsByRouteId();
  const fromListing = (listing.routes || []).filter(route => !!route.gpxFile?.awsFileName);
  const listedIds = new Set(fromListing.map(route => route.id));
  const extras = values(importedById)
    .filter(record => record.gpxFile?.awsFileName && !listedIds.has(record.routeId))
    .map(record => ({
      id: record.routeId,
      title: record.url || record.routeId,
      url: record.url || "",
      createdAt: "",
      createdAtValue: record.importedAt || 0,
      distanceMetres: 0,
      source: OsMapsRouteSource.CREATED,
      importedAt: record.importedAt,
      gpxFile: record.gpxFile,
      routeColor: record.color,
      routeWeight: record.weight,
      routeOpacity: record.opacity
    }));
  return [...fromListing, ...extras].sort((left, right) => (right.importedAt || 0) - (left.importedAt || 0));
}
