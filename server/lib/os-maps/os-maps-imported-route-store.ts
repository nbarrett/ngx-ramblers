import { RouteContributor } from "../../../projects/ngx-ramblers/src/app/models/audit";
import { gpxAudit } from "../walks/walk-gpx-persist";
import { dateTimeNowAsValue } from "../shared/dates";
import { osMapsImportedRoute, OsMapsImportedRouteRecord } from "../mongo/models/os-maps-imported-route";
import { FileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { PaletteColor } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { OsMapsListedRoute, OsMapsRouteImport, osMapsRouteIdFromUrl } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import * as mongooseClient from "../mongo/mongoose-client";

export async function markOsMapsRoutesImported(imports: OsMapsRouteImport[]): Promise<void> {
  const importedAt = dateTimeNowAsValue();
  const records = (imports || []).map(routeImport => {
    const routeId = osMapsRouteIdFromUrl(routeImport.url);
    return routeId ? {routeId, url: routeImport.url, importedAt, gpxFile: routeImport.gpxFile, color: PaletteColor.COBALT, weight: 8, opacity: 1} : null;
  }).filter((record): record is NonNullable<typeof record> => !!record);
  if (records.length > 0) {
    await mongooseClient.execute(() => Promise.all(records.map(async record => {
      const existing = await osMapsImportedRoute.findOne({routeId: record.routeId}).lean();
      const gpxFile = {...record.gpxFile,
        createdDate: existing ? existing.gpxFile?.createdDate || null : record.gpxFile.createdDate,
        createdBy: existing ? existing.gpxFile?.createdBy || null : record.gpxFile.createdBy,
        createdByName: existing ? existing.gpxFile?.createdByName || null : record.gpxFile.createdByName};
      return osMapsImportedRoute.findOneAndUpdate({routeId: record.routeId}, {...record, gpxFile}, {upsert: true, new: true});
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

export async function saveFileImportedGpx(gpxFile: FileNameData, recordingId: string | null = null): Promise<OsMapsImportedRouteRecord> {
  const awsFileName = gpxFile.awsFileName || "";
  const routeId = recordingId ? `recording-${recordingId}` : `gpx-${awsFileName.replace(/\.gpx$/i, "")}`;
  const importedAt = dateTimeNowAsValue();
  const record = {
    routeId,
    url: gpxFile.title || gpxFile.originalFileName || routeId,
    importedAt,
    gpxFile,
    color: PaletteColor.COBALT,
    weight: 8,
    opacity: 1
  };
  return mongooseClient.execute(() => osMapsImportedRoute.findOneAndUpdate(
    {routeId},
    record,
    {upsert: true, new: true, lean: true}
  ));
}

export async function saveOsMapsImportedRoute(routeId: string, update: {
  gpxFile?: FileNameData | null;
  color?: string | null;
  weight?: number | null;
  opacity?: number | null;
}, contributor: RouteContributor | null = null): Promise<OsMapsImportedRouteRecord | null> {
  return mongooseClient.execute(async () => {
    const existing = await osMapsImportedRoute.findOne({routeId}).lean();
    const audit = gpxAudit(contributor);
    const gpxFile = {...(update.gpxFile || existing?.gpxFile),
      createdDate: existing?.gpxFile?.createdDate || null, createdBy: existing?.gpxFile?.createdBy || null,
      createdByName: existing?.gpxFile?.createdByName || null,
      updatedDate: audit.updatedDate, updatedBy: audit.updatedBy, updatedByName: audit.updatedByName};
    return osMapsImportedRoute.findOneAndUpdate({routeId}, {$set: {...update, gpxFile}}, {new: true, lean: true});
  });
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
      routeOpacity: imported?.opacity || null,
      walkedAt: imported?.gpxFile?.walkedAt || null,
      walkedByName: imported?.gpxFile?.walkedByName || null
    };
  });
}
