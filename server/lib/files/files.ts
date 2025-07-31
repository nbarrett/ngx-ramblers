import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("file-download"));
debugLog.enabled = false;

export async function download(req: Request, res: Response) {
  try {
    debugLog("Received req.params:", req.query);
    const file: string = req.query.file as string;
    debugLog("Downloading file:", file);
    res.download(file);
  } catch (error) {
    debugLog("Caught error", error.message);
    res.status(500).send({error: error.message});
  }
}
