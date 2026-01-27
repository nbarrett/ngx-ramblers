import express from "express";
import { postcodeLookup } from "./postcode-lookup";
import { reverseGeocode } from "./reverse-geocode";
import { placeNameLookup } from "./place-name-lookup";
import { googleVenueSearch } from "./google-venue-search";

const router = express.Router();

router.get("/postcodes", postcodeLookup);
router.post("/reverse-geocode", reverseGeocode);
router.get("/place-names", placeNameLookup);
router.get("/venue-search", googleVenueSearch);

export const addresses = router;
