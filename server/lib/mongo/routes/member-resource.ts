import express from "express";
import * as authConfig from "../../auth/auth-config";
import memberResource from "../models/member-resource";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(memberResource, false);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export default router;
