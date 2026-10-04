import { personalOsMapsAccount, savePersonalOsMapsAccount } from "./os-maps-personal-account-store";
import express from "express";
import * as authConfig from "../auth/auth-config";
import { tileProxy } from "./os-maps-proxy";
import {
  deleteOsMapsRoute,
  exportOsMapsRoute,
  latestOsMapsExportJobResult,
  listImportedOsMapsRoutes,
  listOsMapsRoutes,
  publicImportedOsMapsRoute,
  osMapsExportJobResult,
  osMapsImportedRoute,
  refreshOsMapsRoutes,
  updateOsMapsImportedRoute
, cancelOsMapsExport} from "./os-maps-export-controller";

const router = express.Router();

router.get("/personal-account", authConfig.authenticate(), personalOsMapsAccount);
router.put("/personal-account", authConfig.authenticate(), savePersonalOsMapsAccount);

router.get("/tiles/:layer/:z/:x/:y.png", tileProxy);
router.get("/imported-routes", authConfig.optionalAuthenticate(), listImportedOsMapsRoutes);
router.get("/imported-routes/:routeId", authConfig.optionalAuthenticate(), publicImportedOsMapsRoute);
router.get("/routes", authConfig.authenticate(), listOsMapsRoutes);
router.get("/routes/:routeId", authConfig.authenticate(), osMapsImportedRoute);
router.delete("/routes/:routeId", authConfig.authenticate(), authConfig.requireAdmin, deleteOsMapsRoute);
router.put("/routes/:routeId", authConfig.authenticate(), updateOsMapsImportedRoute);
router.post("/routes/refresh", authConfig.authenticate(), refreshOsMapsRoutes);
router.post("/export", authConfig.authenticate(), exportOsMapsRoute);
router.post("/export/cancel", authConfig.authenticate(), authConfig.requireAdmin, cancelOsMapsExport);
router.get("/export/latest", authConfig.authenticate(), latestOsMapsExportJobResult);
router.get("/export/:jobId", authConfig.authenticate(), osMapsExportJobResult);

export const osMapsRoutes = router;
