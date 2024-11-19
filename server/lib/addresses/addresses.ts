import express from "express";
import { postcodes } from "./postcodes";

const router = express.Router();

router.get("/postcodes", postcodes.postcodeLookup);
router.post("/reverse-geocode", postcodes.reverseGeocode);

export const addresses = router;
