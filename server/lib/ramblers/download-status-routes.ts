import express from "express";
import { downloadStatusManager } from "./download-status-manager";

export const downloadStatusRoutes = express.Router();

downloadStatusRoutes.get("/current", (req, res) => {
  const status = downloadStatusManager.getCurrentStatus();
  res.json({ response: status });
});

downloadStatusRoutes.get("/history", (req, res) => {
  res.json({ response: [] });
});

downloadStatusRoutes.post("/override", (req, res) => {
  const fileName = req.body?.fileName;
  if (!fileName) {
    return res.status(400).json({ success: false, message: "fileName is required" });
  }
  const result = downloadStatusManager.overrideDownload(fileName);
  res.json(result);
});

