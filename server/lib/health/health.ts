import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { queryAWSConfig } from "../aws/aws-controllers";

const debugLog = debug(envConfig.logNamespace("health"));
debugLog.enabled = true;

export async function health(req: Request, res: Response) {
  const awsConfig = queryAWSConfig();
  const config = await systemConfig();
  debugLog("AWS config retrieved with region:", awsConfig?.region, "bucket:", awsConfig?.bucket,
    "database config retrieved for:", config.group.shortName, "with group code:", config.group.groupCode);
  res.status(200).send("OK");
}
