import express from "express";
import * as authConfig from "../auth/auth-config";
import { areas, uploadDefaultAreaMap, areaMapKey, deleteAreaMapData, areaGroups, configureAreaGroups, availableDistricts, previewAreaDistricts, listAvailableAreas } from "./areas";

const router = express.Router();

router.get("/", areas);
router.post("/upload-default", authConfig.authenticate(), uploadDefaultAreaMap);
router.delete("/s3-data", authConfig.authenticate(), deleteAreaMapData);
router.get("/key", areaMapKey);
router.get("/groups", areaGroups);
router.get("/districts", availableDistricts);
router.post("/configure-groups", authConfig.authenticate(), configureAreaGroups);
router.get("/preview-districts", previewAreaDistricts);
router.get("/available-areas", listAvailableAreas);

export const geoJsonRoutes = router;
