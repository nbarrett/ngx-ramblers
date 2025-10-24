import express, { Request, Response } from "express";
import * as authConfig from "../../auth/auth-config";
import {
  migrationRunner,
  setMigrationSimulation,
  clearMigrationSimulation,
  readMigrationSimulation,
  clearFailedMigrations
} from "../migrations/migrations-runner";
import debug from "debug";

const debugLog = debug("ngx-ramblers:migrations-routes");
debugLog.enabled = true;

const router = express.Router();

router.post("/retry", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    debugLog("Retry migrations requested by user");
    const result = await migrationRunner.runPendingMigrations();

    res.json({
      success: result.success,
      message: result.success
        ? `Successfully applied ${result.appliedFiles.length} migration(s)`
        : "Migration failed",
      appliedFiles: result.appliedFiles,
      error: result.error
    });
  } catch (error: any) {
    debugLog("Retry migrations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retry migrations",
      error: error.message
    });
  }
});

router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = await migrationRunner.migrationStatus();
    res.json(status);
  } catch (error: any) {
    debugLog("Get migration status error:", error);
    res.status(500).json({
      error: error.message
    });
  }
});

export const migrationsRoutes = router;

router.post("/retry/:fileName", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    debugLog("Retry single migration requested for", fileName);
    const result = await migrationRunner.runMigration(fileName);
    if (result.success) {
      return res.json({ success: true, message: `Successfully applied migration ${fileName}`, appliedFiles: result.appliedFiles });
    } else {
      return res.status(500).json({ success: false, message: `Migration ${fileName} failed`, error: result.error });
    }
  } catch (error: any) {
    debugLog("Retry single migration error:", error);
    res.status(500).json({ success: false, message: "Failed to retry migration", error: error.message });
  }
});

router.post("/simulate-failure", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const pending = Math.max(0, Number(req.body?.pending ?? 1));
    const failed = Boolean(req.body?.failed ?? true);
    await setMigrationSimulation(pending, failed);
    res.json({ success: true, pending, failed });
  } catch (error: any) {
    debugLog("Simulate failure error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/clear-simulation", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    await clearMigrationSimulation();
    res.json({ success: true });
  } catch (error: any) {
    debugLog("Clear simulation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/simulation", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const simulation = await readMigrationSimulation();
    res.json(simulation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/clear-failed", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const result = await clearFailedMigrations();
    res.json(result);
  } catch (error: any) {
    debugLog("Clear failed migrations error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
