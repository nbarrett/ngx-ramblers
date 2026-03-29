import express from "express";
import * as authConfig from "../../auth/auth-config";
import { legacyUrlMapping } from "../models/legacy-url-mapping";
import * as crudController from "../controllers/crud-controller";
import { autoMapLegacyUrls } from "../../legacy-redirect/auto-mapper";
import { invalidateRedirectCache } from "../../legacy-redirect/redirect-middleware";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { pageContent } from "../models/page-content";
import { extendedGroupEvent } from "../models/extended-group-event";

const debugLog = debug(envConfig.logNamespace("legacy-url-mapping-routes"));
const controller = crudController.create<any>(legacyUrlMapping as any);
const router = express.Router();

router.get("/summary", authConfig.authenticate(), async (req, res) => {
  try {
    const domain = req.query.legacyDomain as string;
    const matchStage: any = {};
    if (domain) {
      matchStage.legacyDomain = domain;
    }
    const results = await legacyUrlMapping.aggregate([
      { $match: matchStage },
      {
        $facet: {
          total: [{ $count: "count" }],
          byConfidence: [{ $group: { _id: "$confidence", count: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }]
        }
      }
    ]);
    const facets = results[0];
    const total = facets.total[0]?.count || 0;
    const byConfidence = facets.byConfidence.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const byStatus = facets.byStatus.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    res.json({ total, byConfidence, byStatus });
  } catch (error) {
    debugLog("summary error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/target-urls", async (_req, res) => {
  try {
    const pageContentPaths = await pageContent.distinct("path");
    const walkUrls = await extendedGroupEvent.distinct("groupEvent.url");
    const targetUrls = [
      ...pageContentPaths.filter(Boolean).map((path: string) => ({ path, source: "page" })),
      ...walkUrls.filter(Boolean).map((url: string) => ({ path: `/walks/${url}`, source: "walk" }))
    ];
    res.json(targetUrls);
  } catch (error) {
    debugLog("target-urls error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/bulk-update-status", authConfig.authenticate(), async (req, res) => {
  try {
    const { ids, status } = req.body;
    const result = await legacyUrlMapping.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );
    invalidateRedirectCache();
    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    debugLog("bulk-update-status error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/auto-map", authConfig.authenticate(), async (req, res) => {
  try {
    const { legacyDomain } = req.body;
    const result = await autoMapLegacyUrls(legacyDomain);
    res.json(result);
  } catch (error) {
    debugLog("auto-map error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("", authConfig.authenticate(), async (req, res, next) => {
  await controller.create(req, res);
  invalidateRedirectCache();
});

router.put("/:id", authConfig.authenticate(), async (req, res, next) => {
  await controller.update(req, res);
  invalidateRedirectCache();
});

router.get("", controller.findByConditions);
router.get("/all", controller.all);

router.delete("/:id", authConfig.authenticate(), async (req, res, next) => {
  await controller.deleteOne(req, res);
  invalidateRedirectCache();
});

export const legacyUrlMappingRoutes = router;
