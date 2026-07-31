import express, { Request, Response } from "express";
import debugLib from "debug";
import { isArray } from "es-toolkit/compat";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { Ai } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  AiConnectionStatus,
  CoverImageCandidate
} from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { draftNewsletterIntro, planNewsletter } from "./newsletter-controllers";
import { aiConfigFromEnvironment } from "./ai-config";
import { generate } from "./ai-generation";
import { aiProviderFor } from "./ai-provider-factory";
import {
  aiStatusViaIntegrationWorker,
  chooseCoverViaIntegrationWorker,
  integrationWorkerConfigured
} from "./ai-worker-client";
import { chooseCoverImageFromCandidates } from "./choose-cover-image";

const debug = debugLib(envConfig.logNamespace("ai:text-generation"));
debug.enabled = false;

const router = express.Router();

const WALK_REPORT_SYSTEM_PROMPT = [
  "Rewrite the walk description as a short photo-album report of a completed group walk.",
  "Write in the first person plural as if a member of the group is recounting the day (we, our, us).",
  "Use warm, natural prose in flowing sentences, not a stiff third-person itinerary.",
  "Prefer openings like Starting from... or From... rather than The walk began at... or The route headed....",
  "Describe direction and places in plain English (for example northwest, through open countryside) without inventing places or scenery that are not in the source.",
  "Keep it factual and route-focused, but readable as a short story of the day rather than a bullet-style summary.",
  "Drop pre-walk logistics such as parking prices, meet times, and where the group assembled before setting off.",
  "If the description mentions drinks, coffee, a pub, lunch or a similar stop at the end, include it as something we did together (for example where we enjoyed a well-earned lunch together).",
  "If a walk leader first name is provided, end with a short natural thank-you using only that first name (for example Many thanks to Jayne for leading).",
  "Do not use surnames, initials, or jammed display names such as JayneM in the thank-you.",
  "Aim for two or three sentences plus the thank-you, unless the source needs a little more to cover the route."
].join(" ");

async function connectionStatus(ai: Ai): Promise<AiConnectionStatus> {
  if (integrationWorkerConfigured()) {
    return aiStatusViaIntegrationWorker(ai);
  }
  await aiProviderFor(ai).generate({systemPrompt: "Reply with the single word OK.", input: "ping", maxTokens: 5});
  return {connected: true, model: ai?.model};
}

router.post("/rewrite", authConfig.authenticate(), async (req: Request, res: Response) => {
  const ai: Ai = aiConfigFromEnvironment();
  const input: string = req.body?.input;
  if (!ai.enabled) {
    res.json({request: {}, response: {output: input}});
    return;
  }
  try {
    const output = await generate(ai, req.body?.systemPrompt || WALK_REPORT_SYSTEM_PROMPT, input);
    res.json({request: {}, response: {output}});
  } catch (error) {
    debug("rewrite error:", error);
    res.status(502).json({request: {}, error: error?.message || String(error)});
  }
});

router.post("/newsletter-intro", authConfig.authenticate(), draftNewsletterIntro);

router.post("/newsletter-plan", authConfig.authenticate(), planNewsletter);

router.post("/choose-cover", authConfig.authenticate(), async (req: Request, res: Response) => {
  const ai: Ai = aiConfigFromEnvironment();
  const candidates: CoverImageCandidate[] = isArray(req.body?.candidates) ? req.body.candidates : [];
  const rootFolder: string | undefined = req.body?.rootFolder;
  const albumName: string | undefined = req.body?.albumName;
  if (!candidates.length) {
    res.json({request: {}, response: {image: null}});
    return;
  }
  if (!ai.enabled) {
    debug("choose-cover: AI disabled, using first image");
    res.json({request: {}, response: {image: candidates[0]?.image || null}});
    return;
  }
  try {
    const image = integrationWorkerConfigured()
      ? await chooseCoverViaIntegrationWorker(ai, candidates, rootFolder, albumName)
      : await chooseCoverImageFromCandidates(ai, candidates, rootFolder, albumName);
    debug("choose-cover: selected", image);
    res.json({request: {}, response: {image: image || candidates[0]?.image || null}});
  } catch (error) {
    debug("choose-cover error:", error);
    res.json({request: {}, response: {image: candidates[0]?.image || null}});
  }
});

router.get("/status", authConfig.authenticate(), async (_req: Request, res: Response) => {
  try {
    const status = await connectionStatus(aiConfigFromEnvironment());
    res.json({request: {}, response: status});
  } catch (error) {
    res.json({request: {}, response: {connected: false, error: error?.message || String(error)}});
  }
});

export const aiRoutes = router;
