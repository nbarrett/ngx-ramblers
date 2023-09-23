import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { walk } from "../models/walk";
import { parseError } from "./transforms";

const debugLog = debug(envConfig.logNamespace("walk"));
debugLog.enabled = false;

export function queryWalkLeaderMemberIds(req: Request, res: Response): Promise<void> {
  return walk.distinct("walkLeaderMemberId")
    .then((response: string[]) => {
      debugLog(req.query, "queryWalkLeaderMemberIds:response", response);
      return res.status(200).json({
        action: "query",
        response
      });
    })
    .catch(error => {
      debugLog(`queryWalkLeaderMemberIds: ${walk.modelName} error: ${error}`);
      res.status(500).json({
        message: `${walk.modelName} query failed`,
        request: req.query,
        error: parseError(error)
      });
    });
}
