import express, { Express, NextFunction, Request, Response } from "express";
import path from "path";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("serenity-reports"));
debugLog.enabled = true;

export function setupSerenityReports(app: Express): void {
  const folderNavigationsUp = envConfig.isProduction() ? "../../../../" : "../../";
  const serenityRelativePath = "target/site/serenity";
  const serenityAbsolutePath: string = path.join(__dirname, folderNavigationsUp, serenityRelativePath);
  const reportsEndpoint = `/reports/${serenityRelativePath}`;
  debugLog("serenityAbsolutePath:", serenityAbsolutePath);
  debugLog("reportsEndpoint:", reportsEndpoint);
  app.use(reportsEndpoint, (req: Request, res: Response, next: NextFunction) => {
    debugLog(`Serving ${req.url} from ${serenityAbsolutePath}`);
    next();
  }, express.static(serenityAbsolutePath, {
    setHeaders: (res: Response, filePath: string) => {
      const mimeTypes: { [key: string]: string } = {
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml"
      };
      const ext: string = path.extname(filePath).toLowerCase();
      const mimeType: string = mimeTypes[ext] || "application/octet-stream";
      res.set("Content-Type", mimeType);
    }
  }));

}
