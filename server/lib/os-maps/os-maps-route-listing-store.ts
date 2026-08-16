import { dateTimeNowAsValue } from "../shared/dates";
import { osMapsRouteListing } from "../mongo/models/os-maps-route-listing";
import { OsMapsListedRoute, OsMapsRouteListing } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import * as mongooseClient from "../mongo/mongoose-client";
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
