import debug from "debug";
import express, { Request, Response } from "express";
import { verifyRamblersUploadSignature } from "./integration-worker-crypto";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { Ai } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { CoverImageCandidate } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { aiProviderFor } from "../ai/ai-provider-factory";
import { chooseCoverImageFromCandidates } from "../ai/choose-cover-image";
import { meetingMinutesInput, meetingMinutesSystemPrompt } from "../../../projects/ngx-ramblers/src/app/functions/video-meeting-minutes";

const debugLog = debug(envConfig.logNamespace("integration-worker-ai-routes"));
debugLog.enabled = true;

const router = express.Router();

function requestIsSigned(req: Request): boolean {
  const secret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  if (!secret) {
    return false;
  }
  const signature = req.header("x-ramblers-upload-signature") || "";
  const body = JSON.stringify(req.body ?? {});
  return verifyRamblersUploadSignature(body, secret, signature);
}

interface AiRewriteRequest {
  config: Ai;
  input: string;
  systemPrompt?: string;
  maxTokens?: number;
}

router.post("/rewrite", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({error: "Invalid integration worker request signature"});
    return;
  }
  const body = req.body as AiRewriteRequest;
  try {
    const provider = aiProviderFor(body?.config);
    const output = await provider.generate({systemPrompt: body?.systemPrompt || "", input: body?.input, maxTokens: body?.maxTokens || 1024});
    res.json({output});
  } catch (error) {
    debugLog("rewrite error:", error);
    res.status(502).json({error: (error as Error)?.message || String(error)});
  }
});

router.post("/status", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({error: "Invalid integration worker request signature"});
    return;
  }
  const body = req.body as { config: Ai };
  try {
    const provider = aiProviderFor(body?.config);
    await provider.generate({systemPrompt: "Reply with the single word OK.", input: "ping", maxTokens: 5});
    res.json({connected: true, model: body?.config?.model});
  } catch (error) {
    res.json({connected: false, error: (error as Error)?.message || String(error)});
  }
});

router.post("/meeting-minutes", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({error: "Invalid integration worker request signature"});
  } else {
    const body = req.body as {
      config: Ai;
      transcript?: string;
      chat?: string;
      existingNotes?: string;
      maxTokens?: number;
    };
    try {
      const provider = aiProviderFor(body?.config);
      const output = await provider.generate({
        systemPrompt: meetingMinutesSystemPrompt(),
        input: meetingMinutesInput(body?.transcript || "", body?.chat || "", body?.existingNotes || ""),
        maxTokens: body?.maxTokens || 2048
      });
      res.json({output});
    } catch (error) {
      debugLog("meeting-minutes error:", error);
      res.status(502).json({error: (error as Error)?.message || String(error)});
    }
  }
});

router.post("/choose-cover", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({error: "Invalid integration worker request signature"});
    return;
  }
  const body = req.body as {
    config: Ai;
    candidates: CoverImageCandidate[];
    rootFolder?: string;
    albumName?: string;
  };
  try {
    const image = await chooseCoverImageFromCandidates(
      body?.config,
      body?.candidates || [],
      body?.rootFolder,
      body?.albumName
    );
    res.json({image});
  } catch (error) {
    debugLog("choose-cover error:", error);
    res.status(502).json({error: (error as Error)?.message || String(error)});
  }
});

export const integrationWorkerAiRoutes = router;
