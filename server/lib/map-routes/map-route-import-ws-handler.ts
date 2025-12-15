import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { Feature, FeatureCollection, GeoJsonGeometryTypes, Geometry } from "geojson";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import proj4 from "proj4";
import * as shapefile from "shapefile";
import os from "os";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { EPSG_27700_PROJ4 } from "../../../projects/ngx-ramblers/src/app/common/maps/map-projection.constants";
import {
  MapRouteImportGroupedFile,
  MapRouteImportResponse
} from "../../../projects/ngx-ramblers/src/app/models/map-route-import.model";
import { ServerFileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { generateUid, pluraliseWithCount } from "../shared/string-utils";
import { putObjectDirect } from "../aws/aws-controllers";
import { isAwsUploadErrorResponse } from "../aws/aws-utils";
import { SpatialFeatureModel } from "../mongo/models/spatial-feature";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("map-route-import-ws"));
debugLog.enabled = true;
const errorDebugLog = debug("❌ERROR:" + envConfig.logNamespace("map-route-import-ws"));
errorDebugLog.enabled = true;
const BNG_DEF = `${EPSG_27700_PROJ4} +type=crs`;
proj4.defs("EPSG:27700", BNG_DEF);

interface GroupedFeatures {
  [key: string]: Feature[];
}

interface ProjectionMetadata {
  collection: FeatureCollection;
  sourceCrs?: string;
  transformApplied?: string;
}

type Coordinate = [number, number];
type CoordinateTransformer = (coordinate: Coordinate) => Coordinate;

interface TransformerDescriptor {
  source: string;
  transform: CoordinateTransformer;
}

interface ShapefileParts {
  shp: string;
  dbf: string;
}

export async function handleEsriRouteImport(ws: WebSocket, data: any): Promise<void> {
  const sendProgress = (message: string, percent?: number) => {
    ws.send(JSON.stringify({type: MessageType.PROGRESS, data: {message, percent}}));
  };

  const sendError = (message: string) => {
    ws.send(JSON.stringify({type: MessageType.ERROR, data: {message}}));
  };

  const sendComplete = (response: MapRouteImportResponse) => {
    ws.send(JSON.stringify({type: MessageType.COMPLETE, data: response}));
  };

  try {
    const {filePath, originalName} = data;

    if (!filePath || !fs.existsSync(filePath)) {
      sendError("File path is required and must exist");
      return;
    }

    sendProgress("Parsing uploaded file...", 5);

    const geoJson = await parseUpload(filePath, originalName, sendProgress);
    sendProgress(`Successfully parsed ${geoJson.features.length} features`, 20);

    const grouped = groupFeaturesByProperty(geoJson.features, "StatusDesc");
    const groupCounts = Object.entries(grouped).map(([key, features]) => `${key}: ${features.length}`).join(", ");
    sendProgress(`Grouped features by type: ${groupCounts}`, 25);

    const projection = ensureWgs84(geoJson, sendProgress);
    sendProgress(`Coordinate transformation: ${projection.transformApplied || "not required"}`, 30);

    const baseRouteName = routeNameFrom(originalName, geoJson);
    sendProgress(`Generated base route name: ${baseRouteName}`, 35);

    sendProgress("Uploading original ESRI file...", 40);
    const esriFile = await uploadLocalFile(RootFolder.esriRoutes, originalName, filePath);
    sendProgress("Original ESRI file uploaded", 45);

    const gpxFiles: MapRouteImportGroupedFile[] = [];
    const groupKeys = Object.keys(grouped);
    let processedGroups = 0;

    for (const [statusDesc, features] of Object.entries(grouped)) {
      const groupCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: features.map(f => ({
          ...f,
          geometry: f.geometry ? transformGeometryIfNeeded(f.geometry, projection) : f.geometry
        }))
      };

      const sanitizedType = sanitizeFilename(statusDesc);
      const routeName = `${baseRouteName}-${sanitizedType}`;
      const routeId = generateUid();

      sendProgress(`Removing old ${statusDesc} data if exists...`, 45 + (processedGroups / groupKeys.length) * 40);
      const deleteResult = await SpatialFeatureModel.deleteMany({routeName, featureType: statusDesc});
      if (deleteResult.deletedCount > 0) {
        debugLog(`Deleted ${deleteResult.deletedCount} old features for ${routeName} (${statusDesc})`);
        sendProgress(`Removed ${deleteResult.deletedCount} old ${statusDesc} features`, 45 + (processedGroups / groupKeys.length) * 40);
      }

      sendProgress(`Storing ${statusDesc} features in database...`, 45 + (processedGroups / groupKeys.length) * 40);
      await storeFeaturesInMongoDB(routeId, routeName, statusDesc, groupCollection.features, sendProgress);

      sendProgress(`Converting ${statusDesc} (${features.length} features) to GPX...`, 45 + ((processedGroups + 0.3) / groupKeys.length) * 40);
      const gpxContent = convertToGpx(groupCollection, routeName, true);
      const fileSizeBytes = Buffer.byteLength(gpxContent, "utf8");

      sendProgress(`Uploading ${statusDesc} GPX file...`, 45 + ((processedGroups + 0.6) / groupKeys.length) * 40);
      const gpxFile = await uploadGeneratedGpx(routeName, gpxContent);

      gpxFiles.push({
        type: statusDesc,
        count: features.length,
        file: gpxFile,
        fileSizeBytes,
        routeId
      });

      processedGroups++;
      sendProgress(`Completed ${statusDesc} (${features.length} features)`, 45 + (processedGroups / groupKeys.length) * 40);
    }

    const metadata = buildMetadata(projection.collection, projection);
    const response: MapRouteImportResponse = {
      routeName: baseRouteName,
      gpxFile: gpxFiles[0]?.file,
      gpxFiles,
      esriFile,
      metadata
    };

    sendProgress("Import complete!", 100);
    sendComplete(response);

    await cleanupFile(filePath);
  } catch (error) {
    errorDebugLog("handleEsriRouteImport failed:", error);
    sendError((error as Error).message);
  }
}

async function parseUpload(filePath: string, originalName: string, sendProgress: (message: string, percent?: number) => void): Promise<FeatureCollection> {
  const extension = path.extname(originalName).toLowerCase();
  debugLog("parseUpload: detecting file type, extension:", extension);
  if (extension === ".zip") {
    debugLog("parseUpload: determined file type is zip, calling parseShapefileZip");
    return parseShapefileZip(filePath, sendProgress);
  }
  if (extension === ".json" || extension === ".geojson") {
    debugLog("parseUpload: determined file type is json/geojson, parsing content");
    const text = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(text);
    if (parsed.type === "FeatureCollection") {
      return parsed as FeatureCollection;
    }
  }
  throw new Error(`Unsupported file format: ${extension || "unknown"}`);
}

async function parseShapefileZip(zipPath: string, sendProgress: (message: string, percent?: number) => void): Promise<FeatureCollection> {
  debugLog("parseShapefileZip: starting for zip at", zipPath);
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "esri-"));
  debugLog("parseShapefileZip: created temp directory", tempDir);
  try {
    sendProgress("Extracting shapefile archive...", 10);
    const extractor = new AdmZip(zipPath);
    extractor.extractAllTo(tempDir, true);

    sendProgress("Searching for shapefile components...", 12);
    const shapefilePaths = await findShapefileParts(tempDir);
    if (!shapefilePaths) {
      throw new Error("Unable to locate .shp/.dbf files in archive");
    }

    const features: Feature[] = [];
    sendProgress("Opening shapefile...", 15);
    const source = await shapefile.open(shapefilePaths.shp, shapefilePaths.dbf);

    let result = await source.read();
    let count = 0;
    while (!result.done) {
      features.push({
        type: "Feature",
        geometry: result.value.geometry as Geometry,
        properties: result.value.properties
      });
      count++;
      if (count % 5000 === 0) {
        sendProgress(`Reading features: ${count}...`, 15 + (count / 25000) * 5);
      }
      result = await source.read();
    }

    debugLog("parseShapefileZip: finished reading", features.length, "features");
    if (features.length > 0) {
      const allPropertyKeys = new Set<string>();
      features.forEach(f => {
        if (f.properties) {
          Object.keys(f.properties).forEach(key => allPropertyKeys.add(key));
        }
      });
      debugLog("parseShapefileZip: all unique property keys found:", Array.from(allPropertyKeys));
    }
    return {type: "FeatureCollection", features};
  } finally {
    debugLog("parseShapefileZip: cleaning up temp directory", tempDir);
    await fs.promises.rm(tempDir, {recursive: true, force: true});
  }
}

async function findShapefileParts(directory: string): Promise<ShapefileParts | undefined> {
  const entries = await fs.promises.readdir(directory, {withFileTypes: true});
  let shpPath: string | undefined;
  let dbfPath: string | undefined;
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.name.toLowerCase().endsWith(".shp")) {
      shpPath = fullPath;
    } else if (entry.name.toLowerCase().endsWith(".dbf")) {
      dbfPath = fullPath;
    }
  }
  if (shpPath && dbfPath) {
    return {shp: shpPath, dbf: dbfPath};
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const nested = await findShapefileParts(path.join(directory, entry.name));
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

function ensureWgs84(collection: FeatureCollection, sendProgress: (message: string, percent?: number) => void): ProjectionMetadata {
  debugLog("ensureWgs84: checking if reprojection is needed");
  const transformer = transformerFor(collection);
  if (!transformer) {
    debugLog("ensureWgs84: no transformation needed");
    return {collection};
  }
  debugLog("ensureWgs84: transformation is required from", transformer.source);
  sendProgress(`Transforming coordinates from ${transformer.source} to WGS84...`, 25);

  const transformed: FeatureCollection = {
    ...collection,
    features: collection.features.map((feature, index) => {
      if (index % 5000 === 0) {
        sendProgress(`Transforming coordinates: ${index} / ${collection.features.length}...`, 25 + (index / collection.features.length) * 5);
      }
      return {
        ...feature,
        geometry: feature.geometry ? transformGeometry(feature.geometry, transformer) : feature.geometry
      };
    })
  };
  return {
    collection: transformed,
    sourceCrs: transformer.source,
    transformApplied: `${transformer.source}->WGS84`
  };
}

function transformerFor(collection: FeatureCollection): TransformerDescriptor | undefined {
  const crsName = ((collection as any).crs?.properties?.name || "").toString().toUpperCase();
  if (crsName.includes("27700") || crsName.includes("BRITISH") || crsName.includes("OSGB")) {
    return {
      source: crsName || "EPSG:27700",
      transform: coordinate => proj4("EPSG:27700", "WGS84", coordinate as Coordinate)
    };
  }
  const sample = sampleCoordinate(collection);
  if (sample && (Math.abs(sample[0]) > 180 || Math.abs(sample[1]) > 90)) {
    return {
      source: "detected-27700",
      transform: coordinate => proj4("EPSG:27700", "WGS84", coordinate as Coordinate)
    };
  }
}

function sampleCoordinate(collection: FeatureCollection): Coordinate | undefined {
  for (const feature of collection.features) {
    const coord = extractCoordinate(feature.geometry);
    if (coord) {
      return coord;
    }
  }
  return undefined;
}

function extractCoordinate(geometry: Geometry | null | undefined): Coordinate | undefined {
  if (!geometry) {
    return undefined;
  }
  switch (geometry.type) {
    case "Point":
      return geometry.coordinates as Coordinate;
    case "MultiPoint":
    case "LineString":
      return geometry.coordinates[0] as Coordinate;
    case "MultiLineString":
    case "Polygon":
      return geometry.coordinates[0]?.[0] as Coordinate;
    case "MultiPolygon":
      return geometry.coordinates[0]?.[0]?.[0] as Coordinate;
    case "GeometryCollection":
      for (const inner of geometry.geometries) {
        const coord = extractCoordinate(inner);
        if (coord) {
          return coord;
        }
      }
      return undefined;
    default:
      return undefined;
  }
}

function transformGeometry(geometry: Geometry, transformer: TransformerDescriptor): Geometry {
  switch (geometry.type) {
    case "Point":
      return {...geometry, coordinates: transformer.transform(geometry.coordinates as Coordinate)};
    case "MultiPoint":
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(coordinate => transformer.transform(coordinate as Coordinate))
      };
    case "LineString":
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(coordinate => transformer.transform(coordinate as Coordinate))
      };
    case "MultiLineString":
    case "Polygon":
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(segment => segment.map(coordinate => transformer.transform(coordinate as Coordinate)))
      };
    case "MultiPolygon":
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(polygon => polygon.map(segment => segment.map(coordinate => transformer.transform(coordinate as Coordinate))))
      };
    case "GeometryCollection":
      return {...geometry, geometries: geometry.geometries.map(child => transformGeometry(child, transformer))};
    default:
      return geometry;
  }
}

function buildMetadata(collection: FeatureCollection, projection?: ProjectionMetadata) {
  const geometryTypes = Array.from(new Set(collection.features
    .map(feature => feature.geometry?.type)
    .filter((type): type is GeoJsonGeometryTypes => !!type)));
  return {
    featureCount: collection.features.length,
    geometryTypes,
    coordinateReferenceSystem: (collection as any).crs?.properties?.name,
    bounds: collection.bbox,
    sourceCrs: projection?.sourceCrs,
    transformApplied: projection?.transformApplied
  };
}

function routeNameFrom(originalName: string, geoJson: FeatureCollection): string {
  const parsed = path.parse(originalName);
  const fromProperties = geoJson.features
    .map(featureName)
    .find(name => !!name);
  return fromProperties || parsed.name || `Route-${generateUid().slice(0, 6)}`;
}

function featureName(feature: Feature): string | undefined {
  if (!feature.properties) {
    return undefined;
  }
  const candidates = ["name", "Name", "TITLE", "title"];
  return candidates.map(key => feature.properties?.[key])
    .find(value => typeof value === "string" && value.trim().length > 0);
}

function groupFeaturesByProperty(features: Feature[], propertyKey: string): GroupedFeatures {
  const grouped: GroupedFeatures = {};
  for (const feature of features) {
    const value = feature.properties?.[propertyKey];
    const key = typeof value === "string" && value.trim() ? value : "Unknown";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(feature);
  }
  return grouped;
}

function sanitizeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function transformGeometryIfNeeded(geometry: Geometry, projection: ProjectionMetadata): Geometry {
  if (!projection.transformApplied) {
    return geometry;
  }
  const transformer: TransformerDescriptor = {
    source: projection.sourceCrs || "unknown",
    transform: coordinate => proj4("EPSG:27700", "WGS84", coordinate as Coordinate)
  };
  return transformGeometry(geometry, transformer);
}

function simplifyCoordinates(coordinates: any, tolerance: number): any {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return coordinates;
  }
  if (typeof coordinates[0] === "number") {
    return coordinates;
  }
  if (typeof coordinates[0][0] === "number") {
    if (coordinates.length <= 10) {
      return coordinates;
    }
    const simplified: any[] = [coordinates[0]];
    const step = Math.max(1, Math.floor(coordinates.length * tolerance));
    for (let i = step; i < coordinates.length - 1; i += step) {
      simplified.push(coordinates[i]);
    }
    simplified.push(coordinates[coordinates.length - 1]);
    return simplified;
  }
  return coordinates.map((segment: any) => simplifyCoordinates(segment, tolerance));
}

function simplifyGeometry(geometry: Geometry, tolerance: number): Geometry {
  if (!geometry) {
    return geometry;
  }
  if (geometry.type === "GeometryCollection") {
    return geometry;
  }
  if (!("coordinates" in geometry)) {
    return geometry;
  }
  return {
    ...geometry,
    coordinates: simplifyCoordinates(geometry.coordinates, tolerance)
  };
}

function convertToGpx(geoJson: FeatureCollection, name: string, simplify = true): string {
  const tolerance = simplify ? 0.05 : 0;
  const features = geoJson.features.map(feature => ({
    ...feature,
    geometry: simplify && feature.geometry ? simplifyGeometry(feature.geometry, tolerance) : feature.geometry,
    properties: {
      ...feature.properties,
      name: featureName(feature) || name
    }
  }));

  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ngx-ramblers" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>`;

  const gpxTracks = features.map((feature, index) => {
    const trackName = featureName(feature) || `${name}-${index + 1}`;
    return featureToGpxTrack(feature, trackName);
  }).join("\n");

  return `${gpxHeader}\n${gpxTracks}\n</gpx>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function featureToGpxTrack(feature: Feature, trackName: string): string {
  if (!feature.geometry) {
    return "";
  }
  const coordinates = extractCoordinates(feature.geometry);
  if (coordinates.length === 0) {
    return "";
  }

  const trackPoints = coordinates.map(coord => {
    const [lon, lat, ele] = coord;
    const eleAttr = ele !== undefined ? `<ele>${ele}</ele>` : "";
    return `      <trkpt lat="${lat}" lon="${lon}">${eleAttr}</trkpt>`;
  }).join("\n");

  return `  <trk>
    <name>${escapeXml(trackName)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>`;
}

function extractCoordinates(geometry: Geometry): number[][] {
  if (geometry.type === "LineString") {
    return (geometry as any).coordinates;
  }
  if (geometry.type === "MultiLineString") {
    return (geometry as any).coordinates[0] || [];
  }
  if (geometry.type === "Point") {
    return [(geometry as any).coordinates];
  }
  if (geometry.type === "MultiPoint") {
    return (geometry as any).coordinates;
  }
  if (geometry.type === "Polygon") {
    return (geometry as any).coordinates[0];
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry as any).coordinates[0]?.[0] || [];
  }
  return [];
}

async function uploadGeneratedGpx(routeName: string, contents: string): Promise<ServerFileNameData> {
  debugLog("uploadGeneratedGpx: starting for route", routeName, "content length:", contents.length);
  const temporaryPath = path.join(envConfig.server.uploadDir, `${generateUid()}.gpx`);
  debugLog("uploadGeneratedGpx: writing content to temporary file:", temporaryPath);
  await fs.promises.writeFile(temporaryPath, contents, "utf8");
  debugLog("uploadGeneratedGpx: content written, calling uploadLocalFile");
  try {
    return await uploadLocalFile(RootFolder.gpxRoutes, `${routeName}.gpx`, temporaryPath);
  } finally {
    debugLog("uploadGeneratedGpx: cleaning up temporary file:", temporaryPath);
    await cleanupFile(temporaryPath);
  }
}

async function uploadLocalFile(rootFolder: string, originalFileName: string, localPath: string): Promise<ServerFileNameData> {
  debugLog("uploadLocalFile: starting for file:", originalFileName, "to rootFolder:", rootFolder);
  const extension = path.extname(originalFileName) || path.extname(localPath) || ".dat";
  const awsFileName = `${generateUid()}${extension}`;
  debugLog("uploadLocalFile: generated AWS filename:", awsFileName);
  const response = await putObjectDirect(rootFolder, awsFileName, localPath);
  if (isAwsUploadErrorResponse(response)) {
    debugLog("uploadLocalFile: putObjectDirect returned error:", response);
    throw new Error(response.error || "Failed to upload file to storage");
  }
  debugLog("uploadLocalFile: successfully uploaded file to S3:", awsFileName);
  return {
    rootFolder,
    originalFileName,
    awsFileName
  };
}

async function cleanupFile(localPath: string) {
  if (!localPath) {
    return;
  }
  try {
    await fs.promises.unlink(localPath);
  } catch {
    debugLog("cleanupFile: unable to remove", localPath);
  }
}

function calculateBounds(coordinates: number[][]): {
  southwest: { type: "Point"; coordinates: [number, number] };
  northeast: { type: "Point"; coordinates: [number, number] }
} {
  if (coordinates.length === 0) {
    return {
      southwest: {type: "Point", coordinates: [0, 0]},
      northeast: {type: "Point", coordinates: [0, 0]}
    };
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coordinates) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return {
    southwest: {type: "Point", coordinates: [minLon, minLat]},
    northeast: {type: "Point", coordinates: [maxLon, maxLat]}
  };
}

async function storeFeaturesInMongoDB(
  routeId: string,
  routeName: string,
  featureType: string,
  features: Feature[],
  sendProgress: (message: string, percent?: number) => void
): Promise<number> {
  const startTime = dateTimeNowAsValue();
  debugLog(`📦 storeFeaturesInMongoDB: storing ${features.length} features for ${routeName} (${featureType}), routeId: ${routeId}`);

  sendProgress(`Preparing ${features.length} ${featureType} documents for database...`);
  const prepStartTime = dateTimeNowAsValue();
  const documents = features.map(feature => {
    const geometry = feature.geometry as Geometry;
    const coordinatesForBounds = extractCoordinates(geometry);
    const bounds = calculateBounds(coordinatesForBounds);

    return {
      routeId,
      routeName,
      featureType,
      name: feature.properties?.["PathNo"] || feature.properties?.["NumberStat"] || feature.properties?.["name"] || undefined,
      description: feature.properties?.["StatusDesc"] || feature.properties?.["RouteStat"] || feature.properties?.["description"] || undefined,
      properties: feature.properties || {},
      geometry: {
        type: geometry?.type || "LineString",
        coordinates: (geometry as any)?.coordinates || []
      },
      bounds,
      simplified: true
    };
  });
  const prepTime = dateTimeNowAsValue() - prepStartTime;
  debugLog(`📝 Document preparation took ${prepTime}ms for ${documents.length} documents`);

  sendProgress(`Inserting ${pluraliseWithCount(documents.length, featureType + " document")} into the database...`);
  const insertStartTime = dateTimeNowAsValue();
  const result = await SpatialFeatureModel.insertMany(documents, {ordered: false});
  const insertTime = dateTimeNowAsValue() - insertStartTime;
  const totalTime = dateTimeNowAsValue() - startTime;

  debugLog(`✅ storeFeaturesInMongoDB: inserted ${result.length} documents in ${insertTime}ms (total: ${totalTime}ms, prep: ${prepTime}ms)`);
  sendProgress(`✅ Stored ${result.length} ${featureType} features in database (${totalTime}ms)`);
  return result.length;
}
