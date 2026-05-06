import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as emailComposition from "../controllers/email-composition";

const router = express.Router();

router.get("", authConfig.authenticate(), emailComposition.listForCurrentMember);
router.get("/:id", authConfig.authenticate(), emailComposition.findById);
router.post("", authConfig.authenticate(), emailComposition.create);
router.put("/:id", authConfig.authenticate(), emailComposition.update);
router.delete("/:id", authConfig.authenticate(), emailComposition.deleteOne);

export const emailCompositionRoutes = router;
