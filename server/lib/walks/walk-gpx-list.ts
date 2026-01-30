import { Request, Response } from "express";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { ServerFileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { envConfig } from "../env-config/env-config";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import debug from "debug";
import { DOMParser } from "@xmldom/xmldom";
import { titleCase, humaniseFileStemFromUrl, hasFileExtension } from "../shared/string-utils";
import { kebabCase } from "es-toolkit/compat";
import { EventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { dateTimeFromIso } from "../shared/dates";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("walk-gpx-list"));
debugLog.enabled = true;

const s3Cache: { client?: S3Client } = {};

function s3(): S3Client {
  if (!s3Cache.client) {
    const awsConfig = envConfig.aws();
    s3Cache.client = new S3Client({
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey
      },
      region: awsConfig.region
    });
  }
  return s3Cache.client;
}

interface GpxFileListItem {
  fileData: ServerFileNameData;
  startLat: number;
  startLng: number;
  name: string;
  walkTitle?: string;
  walkDate?: number;
  uploadDate?: number;
}

export async function listWalkGpxFiles(req: Request, res: Response) {
  try {
    const prefix = `${RootFolder.gpxRoutes}/`;
    const bucket = envConfig.aws().bucket;

    debugLog("Listing GPX files from", bucket, prefix);

    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 1000
    });

    const listResponse = await s3().send(listCommand);
    const contents = listResponse.Contents || [];

    debugLog("Found", contents.length, "objects in S3");

    const gpxFiles = contents.filter(obj => obj.Key && hasFileExtension(obj.Key, ".gpx"));

    // Process files sequentially to avoid memory pressure from concurrent S3 requests
    const fileList = await processFilesSequentially(gpxFiles, bucket, prefix);

    debugLog("Returning", fileList.length, "GPX files");
    res.json(fileList);
  } catch (error: any) {
    debugLog("Error listing GPX files:", error);
    res.status(500).json({ error: "Failed to list GPX files", message: error.message });
  }
}

async function processFilesSequentially(
  gpxFiles: { Key?: string; LastModified?: Date }[],
  bucket: string,
  prefix: string
): Promise<GpxFileListItem[]> {
  const results: GpxFileListItem[] = [];
  for (const obj of gpxFiles) {
    const item = await processGpxFile(obj, bucket, prefix);
    results.push(item);
  }
  return results;
}

async function processGpxFile(
  obj: { Key?: string; LastModified?: Date },
  bucket: string,
  prefix: string
): Promise<GpxFileListItem> {
  const key = obj.Key!;
  const awsFileName = key.substring(prefix.length);
  const uploadDate = obj.LastModified ? obj.LastModified.getTime() : undefined;

  const walk = await extendedGroupEvent.findOne({
    [EventField.GPX_FILE_AWS_FILE_NAME]: awsFileName
  }).exec();

  const coordinates = await getOrFetchCoordinates(walk, bucket, key, awsFileName);

  const originalFileName = walk?.fields?.gpxFile?.originalFileName || awsFileName;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.gpx$/i.test(originalFileName);
  const title = walk?.fields?.gpxFile?.title || (isUuid ? "" : titleCase(kebabCase(humaniseFileStemFromUrl(originalFileName))));

  return {
    fileData: {
      rootFolder: RootFolder.gpxRoutes,
      originalFileName,
      awsFileName,
      title
    },
    startLat: coordinates.startLat,
    startLng: coordinates.startLng,
    name: originalFileName,
    uploadDate,
    walkTitle: walk?.groupEvent?.title,
    walkDate: walk?.groupEvent?.start_date_time
      ? dateTimeFromIso(walk.groupEvent.start_date_time).toMillis()
      : undefined
  };
}

async function getOrFetchCoordinates(
  walk: any,
  bucket: string,
  key: string,
  awsFileName: string
): Promise<{ startLat: number; startLng: number }> {
  if (walk?.fields?.gpxFile?.startLat !== undefined && walk?.fields?.gpxFile?.startLng !== undefined) {
    debugLog("Using cached coordinates for:", awsFileName);
    return {
      startLat: walk.fields.gpxFile.startLat,
      startLng: walk.fields.gpxFile.startLng
    };
  }

  debugLog("Parsing GPX file from S3:", awsFileName);
  const parsed = await parseGpxForFirstPoint(bucket, key);

  if (walk && (parsed.startLat !== 0 || parsed.startLng !== 0)) {
    await extendedGroupEvent.updateOne(
      { _id: walk._id },
      { $set: { "fields.gpxFile.startLat": parsed.startLat, "fields.gpxFile.startLng": parsed.startLng } }
    ).exec();
    debugLog("Cached coordinates for:", awsFileName);
  }

  return parsed;
}

async function parseGpxForFirstPoint(bucket: string, key: string): Promise<{ startLat: number; startLng: number }> {
  try {
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const getResponse = await s3().send(getCommand);

    const bodyContents = await streamToString(getResponse.Body as any);

    const parser = new DOMParser();
    const doc = parser.parseFromString(bodyContents, "text/xml");

    const trkpts = doc.getElementsByTagName("trkpt");
    if (trkpts.length > 0) {
      const firstPoint = trkpts[0];
      const lat = parseFloat(firstPoint.getAttribute("lat") || "0");
      const lon = parseFloat(firstPoint.getAttribute("lon") || "0");
      return { startLat: lat, startLng: lon };
    }

    const wpts = doc.getElementsByTagName("wpt");
    if (wpts.length > 0) {
      const firstPoint = wpts[0];
      const lat = parseFloat(firstPoint.getAttribute("lat") || "0");
      const lon = parseFloat(firstPoint.getAttribute("lon") || "0");
      return { startLat: lat, startLng: lon };
    }

    const rtepts = doc.getElementsByTagName("rtept");
    if (rtepts.length > 0) {
      const firstPoint = rtepts[0];
      const lat = parseFloat(firstPoint.getAttribute("lat") || "0");
      const lon = parseFloat(firstPoint.getAttribute("lon") || "0");
      return { startLat: lat, startLng: lon };
    }

    debugLog("No track/waypoint/route points found in GPX file:", key);
    return { startLat: 0, startLng: 0 };
  } catch (error) {
    debugLog("Error parsing GPX file:", key, error);
    return { startLat: 0, startLng: 0 };
  }
}

async function streamToString(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
