import express from "express";
import multer from "multer";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { areas, uploadDefaultAreaMap, areaMapKey, deleteAreaMapData, areaGroups, configureAreaGroups, availableDistricts, previewAreaDistricts, listAvailableAreas, uploadGroupBoundaries, clearGroupBoundary, clearAllGroupBoundaries } from "./areas";

const router = express.Router();
const upload = multer({dest: envConfig.server.uploadDir});

router.get("/", areas);
router.post("/upload-default", authConfig.authenticate(), uploadDefaultAreaMap);
router.delete("/s3-data", authConfig.authenticate(), deleteAreaMapData);
router.get("/key", areaMapKey);
router.get("/groups", areaGroups);
router.get("/districts", availableDistricts);
router.post("/configure-groups", authConfig.authenticate(), configureAreaGroups);
router.get("/preview-districts", previewAreaDistricts);
router.get("/available-areas", listAvailableAreas);
router.post("/upload-group-boundaries", authConfig.authenticate(), upload.single("file"), uploadGroupBoundaries);
router.delete("/group-boundary/:groupCode", authConfig.authenticate(), clearGroupBoundary);
router.delete("/group-boundaries", authConfig.authenticate(), clearAllGroupBoundaries);

export const geoJsonRoutes = router;
