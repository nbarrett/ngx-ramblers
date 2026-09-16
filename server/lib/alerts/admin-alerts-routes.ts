import express, { Request, Response } from "express";
import * as authConfig from "../auth/auth-config";
import { configuredAdminAlertRecipients, setAdminAlertRecipients } from "./admin-alerts";

const router = express.Router();

router.get("/recipients", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    res.status(200).json({response: {recipients: await configuredAdminAlertRecipients()}});
  } catch (error: any) {
    res.status(500).json({error: {message: error?.message || "Failed to load admin alert recipients"}});
  }
});

router.put("/recipients", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const recipients = await setAdminAlertRecipients(req.body?.recipients);
    res.status(200).json({response: {recipients}});
  } catch (error: any) {
    res.status(400).json({error: {message: error?.message || "Failed to save admin alert recipients"}});
  }
});

export const adminAlertsRoutes = router;
