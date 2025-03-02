import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { queryAWSConfig } from "../aws/aws-controllers";

const debugLog = debug(envConfig.logNamespace("health"));
debugLog.enabled = false;

export async function health(req: Request, res: Response) {
  const awsConfig = queryAWSConfig();
  const config = await systemConfig();
  debugLog("configured with awsConfig:", awsConfig, "config:", config);
  res.status(200).send("OK");
}
