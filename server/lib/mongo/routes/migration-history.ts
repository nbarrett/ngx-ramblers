import express from "express";
import * as authConfig from "../../auth/auth-config";
import { migrationHistory } from "../models/migration-history";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create<any>(migrationHistory as any);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const migrationHistoryRoutes = router;

