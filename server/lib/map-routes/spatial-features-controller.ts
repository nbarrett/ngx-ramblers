import express from "express";
import * as authConfig from "../auth/auth-config";
import {SpatialFeatureModel} from "../mongo/models/spatial-feature";
import {envConfig} from "../env-config/env-config";
import debug from "debug";
import {dateTimeNowAsValue} from "../shared/dates";
import { asNumber } from "../../../projects/ngx-ramblers/src/app/functions/numbers";

const debugLog = debug(envConfig.logNamespace("spatial-features"));
debugLog.enabled = true;
const errorDebugLog = debug("❌ERROR:" + envConfig.logNamespace("spatial-features"));
errorDebugLog.enabled = true;

export const spatialFeaturesController = express.Router();

spatialFeaturesController.get("/api/spatial-features/search", authConfig.authenticate(), async (req, res) => {
  try {
    const {routeId, query, limit = 20} = req.query;

    if (!routeId || !query) {
      return res.status(400).json({error: "routeId and query parameters are required"});
    }

    const searchLimit = Math.min(asNumber(limit), 100);

    const results = await SpatialFeatureModel
      .find({
        routeId: routeId as string,
        $text: {$search: query as string}
      })
      .select("name description featureType properties")
      .limit(searchLimit)
      .lean();

    debugLog("Search results for query:", query, "routeId:", routeId, "count:", results.length);
    return res.json(results);
  } catch (error) {
    errorDebugLog("search:error", error);
    return res.status(500).json({error: "Failed to search features"});
  }
});

spatialFeaturesController.get("/api/spatial-features/autocomplete", authConfig.authenticate(), async (req, res) => {
  const startTime = dateTimeNowAsValue();
  try {
    const {routeId, query, limit = 10} = req.query;

    if (!routeId || !query) {
      return res.status(400).json({error: "routeId and query parameters are required"});
    }

    const searchLimit = Math.min(asNumber(limit), 50);
    const queryStr = query as string;

    debugLog(`Autocomplete query for: "${queryStr}" on routeId: ${routeId}`);

    const nameMatches = await SpatialFeatureModel
      .find({
        routeId: routeId as string,
        name: {$regex: queryStr, $options: "i"}
      })
      .select("name description featureType")
      .limit(searchLimit)
      .lean();

    const uniqueNames = new Map<string, {description: string; type: string}>();
    nameMatches.forEach(f => {
      const name = f.name || "";
      if (!uniqueNames.has(name)) {
        uniqueNames.set(name, {
          description: f.description || "",
          type: f.featureType || ""
        });
      }
    });

    const suggestions = Array.from(uniqueNames.entries()).map(([name, {description, type}]) => ({
      value: name,
      label: name,
      description,
      type
    }));

    const queryTime = dateTimeNowAsValue() - startTime;
    debugLog(`✅ Autocomplete completed in ${queryTime}ms, returned ${suggestions.length} suggestions`);

    return res.json(suggestions);
  } catch (error) {
    const queryTime = dateTimeNowAsValue() - startTime;
    errorDebugLog(`autocomplete:error after ${queryTime}ms:`, error);
    return res.status(500).json({error: "Failed to get autocomplete suggestions"});
  }
});

spatialFeaturesController.post("/api/spatial-features/viewport", authConfig.authenticate(), async (req, res) => {
  const startTime = dateTimeNowAsValue();
  try {
    const {routeId, bounds, searchTerm, limit = 1000} = req.body;

    if (!routeId || !bounds) {
      return res.status(400).json({error: "routeId and bounds are required"});
    }

    const {southwest, northeast} = bounds;
    const queryLimit = Math.min(asNumber(limit), 5000);

    debugLog(`Viewport query starting for routeId: ${routeId}, bounds: SW(${southwest.lat},${southwest.lng}) NE(${northeast.lat},${northeast.lng}), searchTerm: "${searchTerm || "none"}"`);

    const query: Record<string, unknown> = {
      routeId
    };

    if (searchTerm) {
      const trimmedSearchTerm = searchTerm.trim();
      debugLog(`Searching for features with name matching: "${trimmedSearchTerm}" (original: "${searchTerm}")`);
      query.name = {$regex: trimmedSearchTerm, $options: "i"};
    } else {
      query["bounds.southwest.coordinates.0"] = {$lte: northeast.lng};
      query["bounds.southwest.coordinates.1"] = {$lte: northeast.lat};
      query["bounds.northeast.coordinates.0"] = {$gte: southwest.lng};
      query["bounds.northeast.coordinates.1"] = {$gte: southwest.lat};
    }

    const features = await SpatialFeatureModel
      .find(query)
      .select("name description featureType geometry properties bounds")
      .limit(queryLimit)
      .lean();

    const queryTime = dateTimeNowAsValue() - startTime;
    debugLog(`✅ Viewport query completed in ${queryTime}ms, returned ${features.length} features (limit: ${queryLimit}, limited: ${features.length === queryLimit})`);

    return res.json({
      features,
      totalCount: features.length,
      limited: features.length === queryLimit
    });
  } catch (error) {
    const queryTime = dateTimeNowAsValue() - startTime;
    errorDebugLog(`viewport:error after ${queryTime}ms:`, error);
    return res.status(500).json({error: "Failed to query viewport features"});
  }
});

spatialFeaturesController.delete("/api/spatial-features/route/:routeId", authConfig.authenticate(), async (req, res) => {
  try {
    const {routeId} = req.params;

    const result = await SpatialFeatureModel.deleteMany({routeId});
    debugLog("Deleted", result.deletedCount, "features for route:", routeId);

    return res.json({deletedCount: result.deletedCount});
  } catch (error) {
    errorDebugLog("deleteRoute:error", error);
    return res.status(500).json({error: "Failed to delete features"});
  }
});

spatialFeaturesController.get("/api/spatial-features/stats/:routeId", authConfig.authenticate(), async (req, res) => {
  try {
    const {routeId} = req.params;

    const stats = await SpatialFeatureModel.aggregate([
      {$match: {routeId}},
      {
        $group: {
          _id: "$featureType",
          count: {$sum: 1}
        }
      }
    ]);

    const totalCount = await SpatialFeatureModel.countDocuments({routeId});

    debugLog("Stats for route:", routeId, "total:", totalCount, "by type:", stats);
    return res.json({
      totalCount,
      byType: stats.reduce((acc, {_id, count}) => ({...acc, [_id]: count}), {})
    });
  } catch (error) {
    errorDebugLog("getStats:error", error);
    return res.status(500).json({error: "Failed to get stats"});
  }
});
