import { Request, Response } from "express";
import debug from "debug";
import { isNumber, kebabCase, uniq } from "es-toolkit/compat";
import { FileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { objectBufferForKey, objectsWithPrefix } from "../aws/aws-controllers";
import { envConfig } from "../env-config/env-config";
import { GpxCoordinates, GpxFileListItem, StoredGpxObject } from "../models/walk-gpx-list.model";
import { parseExportedGpx } from "../os-maps/exported-gpx-parser";
import { dateTimeFromIso } from "../shared/dates";
import { hasFileExtension, humaniseFileStemFromUrl, titleCase } from "../shared/string-utils";
import { importedRoutesWithGpxFiles, storeWalkGpxCoordinates, walksWithGpxFiles } from "./walk-gpx-records";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("walk-gpx-list"));

const GPX_PREFIX = `${RootFolder.gpxRoutes}/`;
const NO_COORDINATES: GpxCoordinates = {startLat: 0, startLng: 0};

export async function listWalkGpxFiles(_req: Request, res: Response) {
  try {
    const fileList = await walkGpxFileList();
    debugLog("Returning", fileList.length, "GPX files");
    res.json(fileList);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog("Error listing GPX files:", error);
    res.status(500).json({error: "Failed to list GPX files", message});
  }
}

export async function walkGpxFileList(): Promise<GpxFileListItem[]> {
  const [walks, importedRoutes, storedObjects] = await Promise.all([walksWithGpxFiles(), importedRoutesWithGpxFiles(), gpxObjectsInS3()]);
  const lastModifiedByName = new Map(storedObjects.map(object => [object.awsFileName, object.lastModified]));
  const repairedCoordinates = await repairedWalkCoordinates(walks);
  const byName = new Map<string, GpxFileListItem>();
  importedRoutes.forEach(route => {
    const gpx = route.gpxFile;
    if (gpx?.awsFileName) {
      byName.set(gpx.awsFileName, listItem(gpx, storedCoordinates(gpx) || NO_COORDINATES, route.importedAt || lastModifiedByName.get(gpx.awsFileName)));
    }
  });
  walks.forEach(walk => {
    const gpx = walk.fields?.gpxFile;
    if (gpx?.awsFileName) {
      byName.set(gpx.awsFileName, {
        ...listItem(gpx, walkCoordinates(walk, repairedCoordinates), lastModifiedByName.get(gpx.awsFileName)),
        walkTitle: walk.groupEvent?.title,
        walkDate: walk.groupEvent?.start_date_time ? dateTimeFromIso(walk.groupEvent.start_date_time).toMillis() : undefined
      });
    }
  });
  storedObjects
    .filter(object => !byName.has(object.awsFileName))
    .forEach(object => byName.set(object.awsFileName, listItem({awsFileName: object.awsFileName}, NO_COORDINATES, object.lastModified)));
  debugLog("Listed", walks.length, "walk files,", importedRoutes.length, "imported routes and", storedObjects.length, "stored objects as", byName.size, "GPX files");
  return [...byName.values()];
}

async function gpxObjectsInS3(): Promise<StoredGpxObject[]> {
  const objects = await objectsWithPrefix(GPX_PREFIX);
  return objects
    .filter(object => hasFileExtension(object.key, ".gpx"))
    .map(object => ({awsFileName: object.key.substring(GPX_PREFIX.length), lastModified: object.lastModified}));
}

function listItem(gpx: FileNameData, coordinates: GpxCoordinates, uploadDate: number | undefined): GpxFileListItem {
  const originalFileName = gpx.originalFileName || gpx.awsFileName;
  return {
    fileData: {
      rootFolder: RootFolder.gpxRoutes,
      originalFileName,
      awsFileName: gpx.awsFileName,
      title: gpx.title || titleFromFileName(originalFileName)
    },
    startLat: coordinates.startLat,
    startLng: coordinates.startLng,
    name: originalFileName,
    uploadDate
  };
}

function storedCoordinates(gpx: FileNameData): GpxCoordinates | null {
  const stored = isNumber(gpx?.startLat) && isNumber(gpx?.startLng) && !(gpx.startLat === 0 && gpx.startLng === 0);
  return stored ? {startLat: gpx.startLat, startLng: gpx.startLng} : null;
}

function walkCoordinates(walk: ExtendedGroupEvent, repairedCoordinates: Map<string, GpxCoordinates>): GpxCoordinates {
  const gpx = walk.fields?.gpxFile;
  const startLocation = walk.groupEvent?.start_location;
  const locationCoordinates = isNumber(startLocation?.latitude) && isNumber(startLocation?.longitude)
    ? {startLat: startLocation.latitude, startLng: startLocation.longitude}
    : NO_COORDINATES;
  return storedCoordinates(gpx) || repairedCoordinates.get(gpx.awsFileName) || locationCoordinates;
}

async function repairedWalkCoordinates(walks: ExtendedGroupEvent[]): Promise<Map<string, GpxCoordinates>> {
  const lacking = uniq(walks.filter(walk => !storedCoordinates(walk.fields?.gpxFile)).map(walk => walk.fields.gpxFile.awsFileName));
  return lacking.reduce((chain, awsFileName) => chain.then(async repaired => {
    const coordinates = await parsedCoordinates(awsFileName);
    if (coordinates) {
      await storeWalkGpxCoordinates(awsFileName, coordinates);
      repaired.set(awsFileName, coordinates);
    }
    return repaired;
  }), Promise.resolve(new Map<string, GpxCoordinates>()));
}

async function parsedCoordinates(awsFileName: string): Promise<GpxCoordinates | null> {
  try {
    const content = await objectBufferForKey(`${GPX_PREFIX}${awsFileName}`);
    const summary = parseExportedGpx(content.toString("utf8"), awsFileName);
    if (summary.startLat === 0 && summary.startLng === 0) {
      debugLog("No start point found in GPX file:", awsFileName);
      return null;
    } else {
      debugLog("Repaired coordinates from GPX file:", awsFileName, summary.startLat, summary.startLng);
      return {startLat: summary.startLat, startLng: summary.startLng};
    }
  } catch (error) {
    debugLog("Could not read GPX file to repair coordinates:", awsFileName, error);
    return null;
  }
}

function titleFromFileName(originalFileName: string): string {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.gpx$/i.test(originalFileName);
  return isUuid ? "" : titleCase(kebabCase(humaniseFileStemFromUrl(originalFileName)));
}
