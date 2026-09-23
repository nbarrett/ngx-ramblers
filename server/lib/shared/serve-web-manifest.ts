import { NextFunction, Request, Response } from "express";
import fs from "fs";
import { systemConfig } from "../config/system-config";
import { resolveClientPath } from "./path-utils";

const staticManifestPath = resolveClientPath("dist/ngx-ramblers/manifest.webmanifest");

export async function serveWebManifest(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = await systemConfig();
    const shortName = config?.group?.shortName || config?.group?.longName || "Ramblers";
    const base = fs.existsSync(staticManifestPath)
      ? JSON.parse(fs.readFileSync(staticManifestPath, "utf-8"))
      : {
        start_url: "/app",
        display: "standalone",
        background_color: "#102018",
        theme_color: "#1b4332",
        orientation: "portrait",
        icons: []
      };
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.type("application/manifest+json").send({
      ...base,
      name: shortName,
      short_name: shortName
    });
  } catch (error) {
    next(error);
  }
}
