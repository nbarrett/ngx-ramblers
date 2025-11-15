import express from "express";
import { tileProxy } from "./os-maps-proxy";

const router = express.Router();

router.get("/tiles/:layer/:z/:x/:y.png", tileProxy);

export const osMapsRoutes = router;
