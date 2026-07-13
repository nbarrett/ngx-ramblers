import { Request, Response } from "express";
import { rematchWalkLeaders, rematchWalkLeadersAfterMemberChange } from "../../walks/walk-leader-rematch";
import { isString } from "es-toolkit/compat";

export async function handleWalkLeaderRematch(req: Request, res: Response): Promise<void> {
  try {
    const uploadSessionId = isString(req.body?.uploadSessionId) ? req.body.uploadSessionId : null;
    const trigger = isString(req.body?.trigger) ? req.body.trigger : "on-demand";
    const summary = uploadSessionId
      ? await rematchWalkLeadersAfterMemberChange(trigger, uploadSessionId)
      : await rematchWalkLeaders(trigger);
    res.json(summary);
  } catch (error) {
    res.status(500).json({error: "Walk leader rematch failed", message: error instanceof Error ? error.message : String(error)});
  }
}
