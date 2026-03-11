import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as crudController from "../controllers/crud-controller";
import { contactInteraction } from "../models/contact-interaction";
import { ContactInteraction } from "../../../../projects/ngx-ramblers/src/app/models/booking.model";

const controller = crudController.create<ContactInteraction>(contactInteraction);
const router = express.Router();

router.post("", controller.create);
router.get("", authConfig.authenticate(), controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", authConfig.authenticate(), controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const contactInteractionRoutes = router;
