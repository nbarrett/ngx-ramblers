import debug from "debug";
import { Request, Response } from "express";
import { Feature, FeatureCollection, GeoJsonGeometryTypes, GeoJsonObject, Geometry, GeometryCollection, Position } from "geojson";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import togpx from "togpx";
import proj4 from "proj4";
import * as shapefile from "shapefile";
import os from "os";
import { envConfig } from "../env-config/env-config";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { EPSG_27700_PROJ4 } from "../../../projects/ngx-ramblers/src/app/common/maps/map-projection.constants";
import { MapRouteImportResponse } from "../../../projects/ngx-ramblers/src/app/models/map-route-import.model";
import {
  AwsInfo,
  AwsUploadErrorResponse,
  ServerFileNameData
} from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { generateUid } from "../shared/string-utils";
import { putObjectDirect } from "../aws/aws-controllers";
import { isAwsUploadErrorResponse } from "../aws/aws-utils";
import { isString, keys } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("map-route-import"));
debugLog.enabled = true;
const BNG_DEF = `${EPSG_27700_PROJ4} +type=crs`;
proj4.defs("EPSG:27700", BNG_DEF);

interface GroupedFeatures {
  [key: string]: Feature[];
}

export async function importEsriRoute(req: Request, res: Response) {
  const upload = req.file;
  debugLog("importEsriRoute: received request with file:", upload);
  if (!upload) {
    res.status(400).json({message: "No file uploaded"});
    return;
  }

  try {
    const geoJson = await parseUpload(upload);
    debugLog("importEsriRoute: successfully parsed upload, features found:", geoJson.features.length);

    const grouped = groupFeaturesByProperty(geoJson.features, "StatusDesc");
    debugLog("importEsriRoute: grouped features by StatusDesc:", keys(grouped).map(key => `${key}: ${grouped[key].length}`));

    const projection = ensureWgs84(geoJson);
    debugLog("importEsriRoute: projection metadata:", {sourceCrs: projection.sourceCrs, transformApplied: projection.transformApplied});

    const baseRouteName = routeNameFrom(upload.originalname, geoJson);
    debugLog("importEsriRoute: base route name:", baseRouteName);

    const esriFile = await uploadLocalFile(RootFolder.esriRoutes, upload.originalname, upload.path);
    debugLog("importEsriRoute: uploaded original ESRI file:", esriFile);

    const gpxFiles: {type: string; count: number; file: ServerFileNameData}[] = [];

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
      const gpxContent = convertToGpx(groupCollection, routeName);
      debugLog(`importEsriRoute: converted ${statusDesc} to GPX, features: ${features.length}, content length: ${gpxContent.length}`);

      const gpxFile = await uploadGeneratedGpx(routeName, gpxContent);
      debugLog(`importEsriRoute: uploaded GPX for ${statusDesc}:`, gpxFile);

      gpxFiles.push({
        type: statusDesc,
        count: features.length,
        file: gpxFile
      });
    }

    const metadata = buildMetadata(projection.collection, projection);
    const response: MapRouteImportResponse = {
      routeName: baseRouteName,
      gpxFile: gpxFiles[0]?.file,
      gpxFiles,
      esriFile,
      metadata
    };
    debugLog("importEsriRoute: responding with success:", response);
    res.status(200).json(response);
  } catch (error) {
    debugLog("importEsriRoute failed:", error);
    res.status(400).json({message: (error as Error).message});
  } finally {
    await cleanupFile(upload.path);
  }
}

async function parseUpload(upload: Express.Multer.File): Promise<FeatureCollection> {
  const extension = path.extname(upload.originalname).toLowerCase();
  debugLog("parseUpload: detecting file type, extension:", extension);
  if (extension === ".zip") {
    debugLog("parseUpload: determined file type is zip, calling parseShapefileZip");
    return await parseShapefileZip(upload.path);
  }
  if (extension === ".json" || extension === ".geojson") {
    debugLog("parseUpload: determined file type is json/geojson, parsing content");
    const text = await fs.promises.readFile(upload.path, "utf8");
    const parsed: GeoJsonObject = JSON.parse(text);
    if (parsed.type === "FeatureCollection") {
      debugLog("parseUpload: successfully parsed GeoJSON FeatureCollection");
      return parsed as FeatureCollection;
    }
  }
  throw new Error(`Unsupported file format: ${extension || "unknown"}`);
}

async function parseShapefileZip(zipPath: string): Promise<FeatureCollection> {
  debugLog("parseShapefileZip: starting for zip at", zipPath);
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "esri-"));
  debugLog("parseShapefileZip: created temp directory", tempDir);
  try {
    const extractor = new AdmZip(zipPath);
    debugLog("parseShapefileZip: extracting zip file to temp directory");
    extractor.extractAllTo(tempDir, true);
    debugLog("parseShapefileZip: extraction complete, searching for shapefile parts");
    const shapefilePaths = await findShapefileParts(tempDir);
    if (!shapefilePaths) {
      debugLog("parseShapefileZip: findShapefileParts returned undefined");
      throw new Error("Unable to locate .shp/.dbf files in archive");
    }
    debugLog("parseShapefileZip: found shapefile parts:", shapefilePaths);
    debugLog("parseShapefileZip: opening shapefile with .open()");
    const source = await shapefile.open(shapefilePaths.shp, shapefilePaths.dbf);
    debugLog("parseShapefileZip: shapefile opened, reading features");
    const collectFeatures = async (acc: Feature[]): Promise<Feature[]> => {
      const result = await source.read();
      if (result.done) return acc;
      return collectFeatures([...acc, {
        type: "Feature",
        geometry: result.value.geometry as Geometry,
        properties: result.value.properties
      }]);
    };
    const features: Feature[] = await collectFeatures([]);
    debugLog("parseShapefileZip: finished reading", features.length, "features");
    if (features.length > 0) {
      const sampleProperties = features.slice(0, 3).map(f => f.properties);
      debugLog("parseShapefileZip: sample feature properties (first 3):", JSON.stringify(sampleProperties, null, 2));
      const allPropertyKeys = new Set<string>();
      features.forEach(f => {
        if (f.properties) {
          keys(f.properties).forEach(key => allPropertyKeys.add(key));
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

interface ShapefileParts {
  shp: string;
  dbf: string;
}

async function findShapefileParts(directory: string): Promise<ShapefileParts | undefined> {
  const entries = await fs.promises.readdir(directory, {withFileTypes: true});
  debugLog(`findShapefileParts: searching directory '${directory}'. Found ${entries.length} entries:`, entries.map(e => `${e.name} ${e.isDirectory() ? "[dir]" : "[file]"}`));
  let shpPath: string | undefined;
  let dbfPath: string | undefined;
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.name.toLowerCase().endsWith(".shp")) {
      debugLog("findShapefileParts: found .shp file:", fullPath);
      shpPath = fullPath;
    } else if (entry.name.toLowerCase().endsWith(".dbf")) {
      debugLog("findShapefileParts: found .dbf file:", fullPath);
      dbfPath = fullPath;
    }
  }
  if (shpPath && dbfPath) {
    debugLog("findShapefileParts: found both .shp and .dbf in current directory, returning paths.");
    return {shp: shpPath, dbf: dbfPath};
  }
  debugLog("findShapefileParts: did not find both files at this level, recursing into subdirectories...");
  for (const entry of entries) {
    if (entry.isDirectory()) {
      debugLog("findShapefileParts: recursing into subdirectory:", entry.name);
      const nested = await findShapefileParts(path.join(directory, entry.name));
      if (nested) {
        debugLog("findShapefileParts: found parts in subdirectory", entry.name, ", returning up.");
        return nested;
      }
    }
  }
  debugLog("findShapefileParts: search of directory", directory, "and all subdirectories finished. No complete shapefile found.");
  return undefined;
}

interface ProjectionMetadata {
  collection: FeatureCollection;
  sourceCrs?: string;
  transformApplied?: string;
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
    .find(value => isString(value) && value.trim().length > 0);
}

function groupFeaturesByProperty(features: Feature[], propertyKey: string): GroupedFeatures {
  const grouped: GroupedFeatures = {};
  for (const feature of features) {
    const value = feature.properties?.[propertyKey];
    const key = isString(value) && value.trim() ? value : "Unknown";
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

function convertToGpx(geoJson: FeatureCollection, name: string): string {
  const enriched = {
    ...geoJson,
    features: geoJson.features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        name: featureName(feature) || name
      }
    }))
  };
  return togpx(enriched);
}

type Coordinate = [number, number];
type CoordinateTransformer = (coordinate: Coordinate) => Coordinate;

function ensureWgs84(collection: FeatureCollection): ProjectionMetadata {
  debugLog("ensureWgs84: checking if reprojection is needed");
  const transformer = transformerFor(collection);
  if (!transformer) {
    debugLog("ensureWgs84: no transformation needed");
    return {collection};
  }
  debugLog("ensureWgs84: transformation is required from", transformer.source);
  const transformed: FeatureCollection = {
    ...collection,
    features: collection.features.map(feature => ({
      ...feature,
      geometry: feature.geometry ? transformGeometry(feature.geometry, transformer) : feature.geometry
    }))
  };
  return {
    collection: transformed,
    sourceCrs: transformer.source,
    transformApplied: `${transformer.source}->WGS84`
  };
}

interface TransformerDescriptor {
  source: string;
  transform: CoordinateTransformer;
}

function transformerFor(collection: FeatureCollection): TransformerDescriptor | undefined {
  const crsName = ((collection as any).crs?.properties?.name || "").toString().toUpperCase();
  debugLog("transformerFor: checking CRS name from GeoJSON:", crsName);
  if (crsName.includes("27700") || crsName.includes("BRITISH") || crsName.includes("OSGB")) {
    debugLog("transformerFor: found CRS name indicating OSGB, will transform");
    return {
      source: crsName || "EPSG:27700",
      transform: coordinate => proj4("EPSG:27700", "WGS84", coordinate as Coordinate)
    };
  }
  const sample = sampleCoordinate(collection);
  debugLog("transformerFor: checking sample coordinate:", sample);
  if (sample && (Math.abs(sample[0]) > 180 || Math.abs(sample[1]) > 90)) {
    debugLog("transformerFor: sample coordinate is outside WGS84 bounds, assuming OSGB and will transform");
    return {
      source: "detected-27700",
      transform: coordinate => proj4("EPSG:27700", "WGS84", coordinate as Coordinate)
    };
  }
  debugLog("transformerFor: no transformation needed based on CRS name or sample coordinate");
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
      return {...geometry, coordinates: geometry.coordinates.map(coordinate => transformer.transform(coordinate as Coordinate))};
    case "LineString":
      return {...geometry, coordinates: geometry.coordinates.map(coordinate => transformer.transform(coordinate as Coordinate))};
    case "MultiLineString":
    case "Polygon":
      return {...geometry, coordinates: geometry.coordinates.map(segment => segment.map(coordinate => transformer.transform(coordinate as Coordinate)))};
    case "MultiPolygon":
      return {...geometry, coordinates: geometry.coordinates.map(polygon => polygon.map(segment => segment.map(coordinate => transformer.transform(coordinate as Coordinate))))};
    case "GeometryCollection":
      return {...geometry, geometries: geometry.geometries.map(child => transformGeometry(child, transformer)) as GeometryCollection["geometries"]};
    default:
      return geometry;
  }
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
  debugLog("uploadLocalFile: starting for file:", originalFileName, "to rootFolder:", rootFolder, "from localPath:", localPath);
  const extension = path.extname(originalFileName) || path.extname(localPath) || ".dat";
  const awsFileName = `${generateUid()}${extension}`;
  debugLog("uploadLocalFile: generated AWS filename:", awsFileName);
  const response: AwsInfo | AwsUploadErrorResponse = await putObjectDirect(rootFolder, awsFileName, localPath);
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
