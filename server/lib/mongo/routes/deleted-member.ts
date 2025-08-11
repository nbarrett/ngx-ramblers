import * as crudController from "../controllers/crud-controller";
import * as authConfig from "../../auth/auth-config";
import { deletedMember } from "../models/deleted-member";
import express from "express";
import { DeletedMember } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const controller = crudController.create<DeletedMember>(deletedMember);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", authConfig.authenticate(), controller.findByConditions);
router.get("/all", controller.all);
router.post("/all", authConfig.authenticate(), controller.createOrUpdateAll);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", authConfig.authenticate(), controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);
router.post("/delete-all", authConfig.authenticate(), controller.deleteAll);

export const deletedMemberRoutes = router;
