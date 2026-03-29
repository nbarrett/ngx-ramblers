import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Feature, FeatureCollection, Geometry } from "geojson";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import * as shapefile from "shapefile";
import os from "os";
import { keys } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("shapefile-parser"));
debugLog.enabled = true;

interface ShapefileParts {
  shp: string;
  dbf: string;
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

export async function parseShapefileZipSync(zipPath: string): Promise<FeatureCollection> {
  debugLog("parseShapefileZipSync: starting for zip at", zipPath);
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "esri-"));
  debugLog("parseShapefileZipSync: created temp directory", tempDir);
  try {
    const extractor = new AdmZip(zipPath);
    extractor.extractAllTo(tempDir, true);

    const shapefilePaths = await findShapefileParts(tempDir);
    if (!shapefilePaths) {
      throw new Error("Unable to locate .shp/.dbf files in archive");
    }

    const source = await shapefile.open(shapefilePaths.shp, shapefilePaths.dbf);

    const collectFeatures = async (acc: Feature[], count: number): Promise<Feature[]> => {
      const result = await source.read();
      if (result.done) return acc;
      return collectFeatures([...acc, {
        type: "Feature",
        geometry: result.value.geometry as Geometry,
        properties: result.value.properties
      }], count + 1);
    };
    const features: Feature[] = await collectFeatures([], 0);

    debugLog("parseShapefileZipSync: finished reading", features.length, "features");
    if (features.length > 0) {
      const allPropertyKeys = new Set<string>();
      features.forEach(f => {
        if (f.properties) {
          keys(f.properties).forEach(key => allPropertyKeys.add(key));
        }
      });
      debugLog("parseShapefileZipSync: property keys:", Array.from(allPropertyKeys));
    }
    return {type: "FeatureCollection", features};
  } finally {
    debugLog("parseShapefileZipSync: cleaning up temp directory", tempDir);
    await fs.promises.rm(tempDir, {recursive: true, force: true});
  }
}
