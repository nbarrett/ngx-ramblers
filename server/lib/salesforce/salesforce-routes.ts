import express from "express";
import * as authConfig from "../auth/auth-config";
import { syncSalesforce, testSalesforceConnection } from "./salesforce-controllers";

const router = express.Router();

router.post("/test-connection", authConfig.authenticate(), testSalesforceConnection);
router.post("/sync", authConfig.authenticate(), syncSalesforce);

export const salesforceRoutes = router;
