import { Request, Response } from "express";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { BuildVersion, DEVELOPMENT_BUILD_NUMBER } from "../../../projects/ngx-ramblers/src/app/models/build-version.model";

export function buildVersion(_req: Request, res: Response): void {
  const response: BuildVersion = {buildNumber: process.env[Environment.BUILD_NUMBER] || DEVELOPMENT_BUILD_NUMBER};
  res.set("Cache-Control", "no-store");
  res.json(response);
}
