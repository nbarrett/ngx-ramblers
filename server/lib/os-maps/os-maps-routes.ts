import express from "express";
import * as authConfig from "../auth/auth-config";
import { tileProxy } from "./os-maps-proxy";
import {
  exportOsMapsRoute,
  listOsMapsRoutes,
  osMapsExportJobResult,
  osMapsImportedRoute,
  refreshOsMapsRoutes,
  updateOsMapsImportedRoute
} from "./os-maps-export-controller";

const router = express.Router();

router.get("/tiles/:layer/:z/:x/:y.png", tileProxy);
router.get("/routes", authConfig.authenticate(), authConfig.requireAdmin, listOsMapsRoutes);
router.get("/routes/:routeId", authConfig.authenticate(), authConfig.requireAdmin, osMapsImportedRoute);
router.put("/routes/:routeId", authConfig.authenticate(), authConfig.requireAdmin, updateOsMapsImportedRoute);
router.post("/routes/refresh", authConfig.authenticate(), authConfig.requireAdmin, refreshOsMapsRoutes);
router.post("/export", authConfig.authenticate(), authConfig.requireAdmin, exportOsMapsRoute);
router.get("/export/:jobId", authConfig.authenticate(), authConfig.requireAdmin, osMapsExportJobResult);

export const osMapsRoutes = router;
