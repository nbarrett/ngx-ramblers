import express from "express";
import { postcodeLookup } from "./postcode-lookup";
import { reverseGeocode } from "./reverse-geocode";

const router = express.Router();

router.get("/postcodes", postcodeLookup);
router.post("/reverse-geocode", reverseGeocode);

export const addresses = router;
