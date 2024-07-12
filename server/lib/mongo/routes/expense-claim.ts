import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as crudController from "../controllers/crud-controller";
import { expenseClaim } from "../models/expense-claim";

const controller = crudController.create(expenseClaim);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", authConfig.authenticate(), controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", authConfig.authenticate(), controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const expenseClaimRoutes = router;
