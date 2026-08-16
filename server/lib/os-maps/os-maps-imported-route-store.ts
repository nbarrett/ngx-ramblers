import { dateTimeNowAsValue } from "../shared/dates";
import { osMapsImportedRoute, OsMapsImportedRouteRecord } from "../mongo/models/os-maps-imported-route";
import { FileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { PaletteColor } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { OsMapsListedRoute, osMapsRouteIdFromUrl } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import * as mongooseClient from "../mongo/mongoose-client";

export async function markOsMapsRoutesImported(routeUrls: string[], gpxFiles: FileNameData[] = []): Promise<void> {
  const importedAt = dateTimeNowAsValue();
  const records = (routeUrls || []).map((url, index) => {
    const routeId = osMapsRouteIdFromUrl(url);
    const gpxFile = gpxFiles[index] || null;
    return routeId ? {routeId, url, importedAt, gpxFile, color: PaletteColor.COBALT, weight: 8, opacity: 1} : null;
  }).filter((record): record is NonNullable<typeof record> => !!record);
  if (records.length > 0) {
    await mongooseClient.execute(() => Promise.all(records.map(record => {
      const update = record.gpxFile
        ? record
        : {routeId: record.routeId, url: record.url, importedAt: record.importedAt};
      return osMapsImportedRoute.findOneAndUpdate(
        {routeId: record.routeId},
        update,
        {upsert: true, new: true}
      );
    })));
  }
}

export async function importedRecordsByRouteId(): Promise<Record<string, OsMapsImportedRouteRecord>> {
  return mongooseClient.execute(() => osMapsImportedRoute.find({}).lean()
    .then(documents => (documents || []).reduce((acc, document) => {
      return document.routeId ? {...acc, [document.routeId]: document} : acc;
    }, {} as Record<string, OsMapsImportedRouteRecord>)));
}

export async function osMapsImportedRouteById(routeId: string): Promise<OsMapsImportedRouteRecord | null> {
  return mongooseClient.execute(() => osMapsImportedRoute.findOne({routeId}).lean());
}

export async function saveOsMapsImportedRoute(routeId: string, update: {
  gpxFile?: FileNameData | null;
  color?: string | null;
  weight?: number | null;
  opacity?: number | null;
}): Promise<OsMapsImportedRouteRecord | null> {
  return mongooseClient.execute(() => osMapsImportedRoute.findOneAndUpdate(
    {routeId},
    {$set: update},
    {new: true, lean: true}
  ));
}

export function withImportedAt(routes: OsMapsListedRoute[], importedById: Record<string, OsMapsImportedRouteRecord>): OsMapsListedRoute[] {
  return (routes || []).map(route => {
    const imported = importedById[route.id];
    return {
      ...route,
      importedAt: imported?.importedAt || 0,
      gpxFile: imported?.gpxFile || null,
      routeColor: imported?.color || null,
      routeWeight: imported?.weight || null,
      routeOpacity: imported?.opacity || null
    };
  });
}
