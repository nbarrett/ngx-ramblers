import { Request, Response } from "express";
import { rematchWalkLeaders } from "../../walks/walk-leader-rematch";

export async function handleWalkLeaderRematch(req: Request, res: Response): Promise<void> {
  try {
    const summary = await rematchWalkLeaders("on-demand");
    res.json(summary);
  } catch (error) {
    res.status(500).json({error: "Walk leader rematch failed", message: error instanceof Error ? error.message : String(error)});
  }
}
