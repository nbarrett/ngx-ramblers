import express from "express";
import { postcodes } from "./postcodes";

const router = express.Router();

router.get("/postcodes", postcodes.postcodeLookup);

export const addresses = router;
