import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as banner from "./../controllers/banner";

const router = express.Router();

router.post("", authConfig.authenticate(), banner.create);
router.get("", authConfig.authenticate(), banner.findByConditions);
router.get("/all", banner.all);
router.put("/:id", authConfig.authenticate(), banner.update);
router.get("/:id", authConfig.authenticate(), banner.findById);
router.delete("/:id", authConfig.authenticate(), banner.deleteOne);

export const bannerRoutes = router;
