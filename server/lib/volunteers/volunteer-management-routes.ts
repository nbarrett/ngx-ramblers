import express from "express";
import multer from "multer";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { bulkUpdateAssignments, coverage, createAssignment, deleteGroupData, endAssignment, saveParish, snapshot, updateAssignment } from "./volunteer-management-controllers";
import { requireVolunteerAdmin } from "./volunteer-management-access";
import { myInformation } from "./my-information-controllers";
import { applyImport, dryRunImport } from "./volunteer-import-controllers";
import { uploadImportFiles } from "./volunteer-import-upload";
import { exportAudits, importAudits, recordExportAudit } from "./volunteer-audit-controllers";

const router = express.Router();
const authenticatedVolunteerAdmin = [authConfig.authenticate(), requireVolunteerAdmin];
const importUpload = multer({dest: envConfig.server.uploadDir}).single("workbook");

router.get("/coverage", coverage);
router.get("/my-information", authConfig.authenticate(), myInformation);
router.get("/snapshot", ...authenticatedVolunteerAdmin, snapshot);
router.put("/parishes", ...authenticatedVolunteerAdmin, saveParish);
router.post("/assignments", ...authenticatedVolunteerAdmin, createAssignment);
router.put("/assignments/:id", ...authenticatedVolunteerAdmin, updateAssignment);
router.post("/assignments/bulk", ...authenticatedVolunteerAdmin, bulkUpdateAssignments);
router.post("/assignments/:id/end", ...authenticatedVolunteerAdmin, endAssignment);
router.post("/import/upload", ...authenticatedVolunteerAdmin, importUpload, uploadImportFiles);
router.get("/import/audits", ...authenticatedVolunteerAdmin, importAudits);
router.post("/import/dry-run", ...authenticatedVolunteerAdmin, dryRunImport);
router.post("/import/apply", ...authenticatedVolunteerAdmin, applyImport);
router.get("/export/audits", ...authenticatedVolunteerAdmin, exportAudits);
router.post("/export/audit", ...authenticatedVolunteerAdmin, recordExportAudit);
router.post("/delete-group-data", ...authenticatedVolunteerAdmin, deleteGroupData);

export const volunteerManagementRoutes = router;
