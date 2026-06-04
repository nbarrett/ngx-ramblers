import express, { Request, Response } from "express";
import * as authConfig from "../auth/auth-config";
import {
  scheduledTasks,
  setScheduledTaskCronExpression,
  setScheduledTaskEnabled,
  setScheduledTaskSettings,
  triggerScheduledTask
} from "./scheduled-task-registry";

const router = express.Router();

router.get("", authConfig.authenticate(), (req: Request, res: Response) => {
  res.status(200).json({response: scheduledTasks()});
});

router.post("/:id/trigger", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const task = await triggerScheduledTask(req.params.id);
    if (task) {
      res.status(200).json({response: task});
    } else {
      res.status(404).json({message: "Scheduled task not found"});
    }
  } catch (error: any) {
    res.status(500).json({error: {message: error?.message || "Scheduled task run failed"}});
  }
});

router.put("/:id/enabled", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const task = await setScheduledTaskEnabled(req.params.id, req.body.enabled === true);
    if (task) {
      res.status(200).json({response: task});
    } else {
      res.status(404).json({message: "Scheduled task not found"});
    }
  } catch (error: any) {
    res.status(500).json({error: {message: error?.message || "Scheduled task update failed"}});
  }
});

router.put("/:id/schedule", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const task = await setScheduledTaskCronExpression(req.params.id, req.body.cronExpression || "");
    if (task) {
      res.status(200).json({response: task});
    } else {
      res.status(404).json({message: "Scheduled task not found"});
    }
  } catch (error: any) {
    res.status(400).json({error: {message: error?.message || "Scheduled task schedule update failed"}});
  }
});

router.put("/:id/settings", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const task = await setScheduledTaskSettings(req.params.id, req.body.settings || {});
    if (task) {
      res.status(200).json({response: task});
    } else {
      res.status(404).json({message: "Scheduled task not found"});
    }
  } catch (error: any) {
    res.status(400).json({error: {message: error?.message || "Scheduled task settings update failed"}});
  }
});

export const scheduledTaskRoutes = router;
