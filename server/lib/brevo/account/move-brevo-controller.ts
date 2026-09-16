import { Request, Response } from "express";
import { moveBrevo, moveBrevoJob, startMoveBrevo } from "./move-brevo";
import { MoveBrevoRequest } from "../../../../projects/ngx-ramblers/src/app/models/move-brevo.model";

function requestFrom(req: Request): MoveBrevoRequest {
  return {
    environment: req.body.environment,
    destinationApiKey: req.body.destinationApiKey,
    confirmEnvironment: req.body.confirmEnvironment,
    dryRun: req.body.dryRun === true,
    user: req.body.user
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function planMoveBrevo(req: Request, res: Response): Promise<void> {
  try {
    const result = await moveBrevo({ ...requestFrom(req), dryRun: true });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
}

export function executeMoveBrevo(req: Request, res: Response): void {
  try {
    const job = startMoveBrevo({ ...requestFrom(req), dryRun: false });
    res.status(202).json(job);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
}

export function moveBrevoJobStatus(req: Request, res: Response): void {
  const job = moveBrevoJob(req.params.jobId);
  if (job) {
    res.json(job);
  } else {
    res.status(404).json({ error: "Move Brevo job not found; the server may have restarted while it was running. Validate the plan again before propagating." });
  }
}
