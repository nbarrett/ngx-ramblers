import { RouteContributor } from "../../../projects/ngx-ramblers/src/app/models/audit";
import { gpxAudit } from "../walks/walk-gpx-persist";
import { dateTimeNowAsValue } from "../shared/dates";
import { ImportedRouteNumberCounter, osMapsImportedRoute, OsMapsImportedRouteRecord } from "../mongo/models/os-maps-imported-route";
import { FileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { PaletteColor } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { OsMapsImportContext, RouteVisibility, OsMapsListedRoute, OsMapsRouteImport, osMapsRouteIdFromUrl } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import * as mongooseClient from "../mongo/mongoose-client";
import mongoose from "mongoose";

const ROUTE_NUMBER_COUNTER_ID = "imported-route-number";

export async function allocateImportedRouteNumber(): Promise<number> {
  return mongooseClient.execute(async () => {
    const result = await mongoose.connection.collection<ImportedRouteNumberCounter>("counters").findOneAndUpdate(
      {_id: ROUTE_NUMBER_COUNTER_ID},
      {$inc: {seq: 1}},
      {upsert: true, returnDocument: "after"}
    );
    const seq = result && "seq" in result ? Number(result.seq) : 0;
    if (seq > 0) {
      return seq;
    } else {
      return 1;
    }
  });
}

async function immutableRouteNumber(existing: OsMapsImportedRouteRecord | null): Promise<number> {
  if (existing?.number) {
    return existing.number;
  } else {
    return allocateImportedRouteNumber();
  }
}

export async function markOsMapsRoutesImported(imports: OsMapsRouteImport[], context: OsMapsImportContext = {}): Promise<void> {
  const importedAt = dateTimeNowAsValue();
  const records = (imports || []).map(routeImport => {
    const routeId = osMapsRouteIdFromUrl(routeImport.url);
    return routeId ? {routeId, url: routeImport.url, importedAt, gpxFile: routeImport.gpxFile, color: PaletteColor.COBALT, weight: 8, opacity: 1} : null;
  }).filter((record): record is NonNullable<typeof record> => !!record);
  if (records.length > 0) {
    await mongooseClient.execute(() => Promise.all(records.map(async record => {
      const existing = await osMapsImportedRoute.findOne({routeId: record.routeId}).lean();
      if (context.accountOwnerId && existing?.gpxFile?.awsFileName && existing.ownerMemberId !== context.ownerMemberId) {
        throw new Error("This route has already been imported by another member");
      }
      const number = await immutableRouteNumber(existing);
      const gpxFile = {...record.gpxFile,
        createdDate: existing ? existing.gpxFile?.createdDate || null : record.gpxFile.createdDate,
        createdBy: existing ? existing.gpxFile?.createdBy || null : record.gpxFile.createdBy,
        createdByName: existing ? existing.gpxFile?.createdByName || null : record.gpxFile.createdByName};
      return osMapsImportedRoute.findOneAndUpdate(
        {routeId: record.routeId},
        {$set: {...record, number, gpxFile, ownerMemberId: existing?.ownerMemberId || context.ownerMemberId || null, visibility: existing?.visibility || context.visibility || null}},
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

export async function osMapsImportedRouteByNumber(routeNumber: number): Promise<OsMapsImportedRouteRecord | null> {
  return mongooseClient.execute(() => osMapsImportedRoute.findOne({number: routeNumber}).lean());
}

export async function saveFileImportedGpx(gpxFile: FileNameData, recordingId: string | null = null): Promise<OsMapsImportedRouteRecord> {
  const awsFileName = gpxFile.awsFileName || "";
  const routeId = recordingId ? `recording-${recordingId}` : `gpx-${awsFileName.replace(/\.gpx$/i, "")}`;
  const importedAt = dateTimeNowAsValue();
  return mongooseClient.execute(async () => {
    const existing = await osMapsImportedRoute.findOne({routeId}).lean();
    const number = await immutableRouteNumber(existing);
    const record = {
      routeId,
      number,
      url: gpxFile.title || gpxFile.originalFileName || routeId,
      importedAt: existing?.importedAt || importedAt,
      gpxFile,
      color: existing?.color || PaletteColor.COBALT,
      weight: existing?.weight || 8,
      opacity: existing?.opacity ?? 1
    };
    return osMapsImportedRoute.findOneAndUpdate(
      {routeId},
      {$set: record},
      {upsert: true, new: true, lean: true}
    );
  });
}

export async function saveOsMapsImportedRoute(routeId: string, update: {
  visibility?: RouteVisibility;
  gpxFile?: FileNameData | null;
  color?: string | null;
  weight?: number | null;
  opacity?: number | null;
  waypoints?: OsMapsListedRoute["waypoints"];
  difficulty?: OsMapsListedRoute["difficulty"];
}, contributor: RouteContributor | null = null): Promise<OsMapsImportedRouteRecord | null> {
  return mongooseClient.execute(async () => {
    const existing = await osMapsImportedRoute.findOne({routeId}).lean();
    if (!existing) {
      return null;
    } else {
      const audit = gpxAudit(contributor);
      const gpxFile = {...(update.gpxFile || existing?.gpxFile),
        createdDate: existing?.gpxFile?.createdDate || null, createdBy: existing?.gpxFile?.createdBy || null,
        createdByName: existing?.gpxFile?.createdByName || null,
        updatedDate: audit.updatedDate, updatedBy: audit.updatedBy, updatedByName: audit.updatedByName};
      const url = gpxFile.title || existing.url;
      return osMapsImportedRoute.findOneAndUpdate({routeId}, {$set: {...update, gpxFile, ...(url ? {url} : {})}}, {new: true, lean: true});
    }
  });
}

export function withImportedAt(routes: OsMapsListedRoute[], importedById: Record<string, OsMapsImportedRouteRecord>): OsMapsListedRoute[] {
  return (routes || []).map(route => {
    const imported = importedById[route.id];
    return {
      ...route,
      number: imported?.number || route.number || null,
      importedAt: imported?.importedAt || 0,
      ownerMemberId: imported?.ownerMemberId || null,
      visibility: imported?.visibility || null,
      gpxFile: imported?.gpxFile || null,
      routeColor: imported?.color || null,
      routeWeight: imported?.weight || null,
      routeOpacity: imported?.opacity || null,
      walkedAt: imported?.gpxFile?.walkedAt || null,
      walkedByName: imported?.gpxFile?.walkedByName || null,
      waypoints: imported?.waypoints || route.waypoints || null,
      difficulty: imported?.difficulty || route.difficulty || null
    };
  });
}
