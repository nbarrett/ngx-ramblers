import { Request, Response } from "express";
import { resizeQueueState } from "../aws/image-resize-session-registry";

export function resizeStatus(req: Request, res: Response): void {
  res.json(resizeQueueState(req.params.contentMetadataId) || null);
}
