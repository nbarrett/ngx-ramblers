import express, { Request, Response } from "express";
import * as authConfig from "../auth/auth-config";
import { adminAlertEmails, setAdminAlertEmails } from "./admin-alerts";

const router = express.Router();

router.get("/emails", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    res.status(200).json({response: {alertEmails: await adminAlertEmails()}});
  } catch (error: any) {
    res.status(500).json({error: {message: error?.message || "Failed to load admin alert emails"}});
  }
});

router.put("/emails", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const alertEmails = await setAdminAlertEmails(req.body?.alertEmails);
    res.status(200).json({response: {alertEmails}});
  } catch (error: any) {
    res.status(400).json({error: {message: error?.message || "Failed to save admin alert emails"}});
  }
});

export const adminAlertsRoutes = router;
