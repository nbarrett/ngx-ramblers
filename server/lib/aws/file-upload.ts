import { isObject, map } from "es-toolkit/compat";
import { AuditStatus } from "../../../projects/ngx-ramblers/src/app/models/audit";
import {
  AwsFileUploadResponse,
  AwsFileUploadResponseData,
  AwsInfo,
  AwsUploadErrorResponse,
  ServerFileNameData,
  UploadedFile
} from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { envConfig } from "../env-config/env-config";
import { hasFileExtension } from "../shared/string-utils";
import * as aws from "./aws-controllers";
import debug from "debug";
import { createFileNameData, generateAwsFileName, isAwsUploadErrorResponse } from "./aws-utils";
import { Request, Response } from "express";
import * as fs from "fs";
import proj4 from "proj4";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("s3-file-upload"));
debugLog.enabled = true;
export { uploadFile };

function uploadFile(req: Request, res: Response) {

  const bulkUploadError = {error: undefined};

  debugLog("Received file request with req.query", req.query);
  const awsFileUploadResponse: AwsFileUploadResponse = {responses: [], errors: []};
  const rootFolder: string = req.query["root-folder"]?.toString();
  const uploadedFiles: UploadedFile[] = req.files as UploadedFile[];
  debugLog("About to process", uploadedFiles.length, "received uploadedFiles:", uploadedFiles);
  Promise.all(uploadedFiles.map(async (uploadedFile: UploadedFile) => {
    await normalizeGpxIfNeeded(uploadedFile, rootFolder);
    const fileNameData: ServerFileNameData = generateFileNameData(uploadedFile);
    const fileUploadResponseData: AwsFileUploadResponseData = createFileUploadResponseData();
    debugAndInfo(fileUploadResponseData, "Received file", "rootFolder", rootFolder, uploadedFile.originalname, "to", uploadedFile.path,
      "containing", uploadedFile.size, "bytes", "renaming to", fileNameData.awsFileName);
    return aws.putObjectDirect(rootFolder, fileNameData.awsFileName, uploadedFile.path).then((response: AwsInfo | AwsUploadErrorResponse) => {
      if (isAwsUploadErrorResponse(response)) {
        awsFileUploadResponse.errors.push(response);
        return response;
      } else {
        fileUploadResponseData.awsInfo = response;
        fileUploadResponseData.fileNameData = fileNameData;
        fileUploadResponseData.uploadedFile = uploadedFile;
        logWithStatus(AuditStatus.info, fileUploadResponseData, "File upload completed successfully after processing", uploadedFile.path);
        awsFileUploadResponse.responses.push(fileUploadResponseData);
        return response;
      }
    });
  })).then((response: Awaited<AwsUploadErrorResponse | AwsInfo>[]) => {
    debugLog("Upload of", uploadedFiles.length, "complete:success:", awsFileUploadResponse.responses.length, "errors:", awsFileUploadResponse.errors.length, "response:", response, "returning awsFileUploadResponse:", awsFileUploadResponse);
    res.json(awsFileUploadResponse);
  });

  function createFileUploadResponseData(): AwsFileUploadResponseData {
    return {
      awsInfo: {information: null, responseData: {ETag: null}},
      fileNameData: undefined,
      uploadedFile: {
        destination: null,
        encoding: null,
        fieldname: null,
        filename: null,
        mimetype: null,
        originalname: null,
        path: null,
        size: 0
      },
      files: {}, auditLog: []
    };
  }

  function generateFileNameData(uploadedFile: UploadedFile): ServerFileNameData {
    const awsFileName = generateAwsFileName(uploadedFile.originalname);
    debugLog("generateFileNameData:uploadedFile:", uploadedFile, "awsFileName:", awsFileName);
    return createFileNameData(rootFolder, uploadedFile.originalname, awsFileName);
  }

  function logWithStatus(status: AuditStatus, fileUploadResponseData: AwsFileUploadResponseData, ...argumentsData: any[]) {
    const debugData = map(argumentsData, item => isObject(item) ? JSON.stringify(item) : item).join(" ");
    debugLog(debugData);
    fileUploadResponseData.auditLog.push({status, message: debugData});
    if (status === "error") {
      bulkUploadError.error = debugData;
    }
  }

  function debugAndInfo(fileUploadResponseData: AwsFileUploadResponseData, ...argumentsData: any[]) {
    logWithStatus(AuditStatus.info, fileUploadResponseData, ...argumentsData);
  }

}

async function normalizeGpxIfNeeded(uploadedFile: UploadedFile, rootFolder: string): Promise<boolean> {
  const fileName = uploadedFile?.originalname || "";
  if (!hasFileExtension(fileName, ".gpx")) {
    debugLog("normalizeGpxIfNeeded: skipping non-gpx file", fileName);
    return false;
  } else if (rootFolder && rootFolder !== RootFolder.gpxRoutes) {
    debugLog("normalizeGpxIfNeeded: skipping due to root folder", fileName, rootFolder);
    return false;
  } else {
    try {
      debugLog("normalizeGpxIfNeeded: reading GPX for", fileName);
      const xml = await fs.promises.readFile(uploadedFile.path, "utf8");
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      if (!shouldUpdateGpxMetadata(doc)) {
        debugLog("normalizeGpxIfNeeded: metadata indicates conversion not required", fileName);
        return false;
      }
      debugLog("normalizeGpxIfNeeded: converting GPX to WGS84 for", fileName);
      convertAllPoints(doc);
      stripOgrMetadata(doc);
      markAsProcessed(doc);
      const serializer = new XMLSerializer();
      await fs.promises.writeFile(uploadedFile.path, serializer.serializeToString(doc));
      debugLog("normalizeGpxIfNeeded: converted GPX to WGS84 for", uploadedFile.originalname);
      return true;
    } catch (error) {
      debugLog("normalizeGpxIfNeeded: failed to convert GPX", uploadedFile.originalname, error);
      return false;
    }
  }
}

function shouldUpdateGpxMetadata(doc: Document): boolean {
  const root = doc.documentElement;
  const processed = (root.getAttribute("data-ngx-crs") || "").length > 0;
  if (processed) {
    debugLog("shouldUpdateGpxMetadata: already processed via data-ngx-crs");
    return false;
  } else {
    const creator = (root.getAttribute("creator") || "").toLowerCase();
    if (creator.includes("ngx-ramblers")) {
      debugLog("shouldUpdateGpxMetadata: already produced by ngx-ramblers");
      return false;
    } else if (creator.includes("gdal") || creator.includes("ogr2ogr")) {
      debugLog("shouldUpdateGpxMetadata: creator indicates GDAL or ogr2ogr");
      return true;
    } else if (hasOgrNodes(doc) || hasOgrNamespace(root)) {
      debugLog("shouldUpdateGpxMetadata: ogr metadata detected");
      return true;
    } else if (creator.includes("os maps") || hasOsNamespace(root)) {
      debugLog("shouldUpdateGpxMetadata: OS Maps metadata detected");
      return true;
    } else {
      debugLog("shouldUpdateGpxMetadata: no conversion needed");
      return false;
    }
  }
}

function hasOgrNodes(doc: Document): boolean {
  return Array.from(doc.getElementsByTagName("*"))
    .some(node => node.nodeName.toLowerCase().startsWith("ogr:"));
}

function hasOgrNamespace(root: Element): boolean {
  return Array.from({length: root.attributes.length})
    .map((_, index) => root.attributes.item(index))
    .some(attr => attr?.name.toLowerCase().startsWith("xmlns:ogr"));
}

function hasOsNamespace(root: Element): boolean {
  return Array.from({length: root.attributes.length})
    .map((_, index) => root.attributes.item(index))
    .some(attr => attr?.name.toLowerCase().startsWith("xmlns:os"));
}

function markAsProcessed(doc: Document) {
  const root = doc.documentElement;
  root.setAttribute("creator", "ngx-ramblers");
  root.setAttribute("data-ngx-crs", "wgs84");
}

interface Bounds {
  minLat?: number;
  maxLat?: number;
  minLon?: number;
  maxLon?: number;
}

function convertAllPoints(doc: Document) {
  const bounds: Bounds = {};
  convertPoints(doc.getElementsByTagName("trkpt"), bounds);
  convertPoints(doc.getElementsByTagName("wpt"), bounds);
  convertPoints(doc.getElementsByTagName("rtept"), bounds);
  updateBoundsElement(doc, bounds);
}

function convertPoints(elements: HTMLCollectionOf<Element>, bounds: Bounds) {
  Array.from(elements).forEach(element => {
    const lat = parseFloat(element.getAttribute("lat") || "");
    const lon = parseFloat(element.getAttribute("lon") || "");
    if (isNaN(lat) || isNaN(lon)) {
      return;
    }
    const [convertedLon, convertedLat] = proj4("EPSG:4277", "WGS84", [lon, lat]);
    element.setAttribute("lat", convertedLat.toString());
    element.setAttribute("lon", convertedLon.toString());
    updateBounds(bounds, convertedLat, convertedLon);
  });
}

function updateBounds(bounds: Bounds, lat: number, lon: number) {
  bounds.minLat = bounds.minLat == null ? lat : Math.min(bounds.minLat, lat);
  bounds.maxLat = bounds.maxLat == null ? lat : Math.max(bounds.maxLat, lat);
  bounds.minLon = bounds.minLon == null ? lon : Math.min(bounds.minLon, lon);
  bounds.maxLon = bounds.maxLon == null ? lon : Math.max(bounds.maxLon, lon);
}

function updateBoundsElement(doc: Document, bounds: Bounds) {
  if (bounds.minLat == null || bounds.maxLat == null || bounds.minLon == null || bounds.maxLon == null) {
    return;
  }
  const boundsEl = doc.getElementsByTagName("bounds")[0];
  if (!boundsEl) {
    return;
  }
  boundsEl.setAttribute("minlat", bounds.minLat.toString());
  boundsEl.setAttribute("maxlat", bounds.maxLat.toString());
  boundsEl.setAttribute("minlon", bounds.minLon.toString());
  boundsEl.setAttribute("maxlon", bounds.maxLon.toString());
}

function stripOgrMetadata(doc: Document) {
  const root = doc.documentElement;
  Array.from({length: root.attributes.length})
    .map((_, index) => root.attributes.item(index))
    .filter(attr => attr?.name.toLowerCase().startsWith("xmlns:ogr"))
    .map(attr => attr?.name)
    .filter((name): name is string => !!name)
    .forEach(name => root.removeAttribute(name));

  Array.from(doc.getElementsByTagName("*"))
    .filter(node => node.nodeName.toLowerCase().startsWith("ogr:"))
    .forEach(node => node.parentNode?.removeChild(node));
}
