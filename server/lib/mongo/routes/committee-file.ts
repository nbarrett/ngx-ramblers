import express from "express";
import * as authConfig from "../../auth/auth-config";
import committeeFile from "../models/committee-file";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(committeeFile);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export default router;
