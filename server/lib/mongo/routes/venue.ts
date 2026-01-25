import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as venue from "./../controllers/venue";

const router = express.Router();

router.post("", authConfig.authenticate(), venue.create);
router.post("/find-or-create", authConfig.authenticate(), venue.findOrCreate);
router.post("/update-coordinates", authConfig.authenticate(), venue.updateCoordinates);
router.get("", venue.findByConditions);
router.get("/all", venue.all);
router.put("/:id", authConfig.authenticate(), venue.update);
router.get("/:id", venue.findById);
router.delete("/:id", authConfig.authenticate(), venue.deleteOne);

export const venueRoutes = router;
