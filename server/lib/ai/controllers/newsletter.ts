import { Request, Response } from "express";
import debugLib from "debug";
import { isArray } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { dateTimeNowAsValue } from "../../shared/dates";
import { Ai } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  NewsletterIntroRequest,
  NewsletterPlanRequest
} from "../../../../projects/ngx-ramblers/src/app/models/ai.model";
import { aiConfigFromEnvironment } from "../ai-config";
import { generate } from "../ai-generation";
import { buildNewsletterIntroInput, systemPromptFor } from "../newsletter-intro";
import { buildNewsletterPlanInput, NEWSLETTER_PLAN_SYSTEM_PROMPT, parseNewsletterPlan } from "../newsletter-plan";

const debug = debugLib(envConfig.logNamespace("ai:newsletter"));
debug.enabled = false;

export async function draftNewsletterIntro(req: Request, res: Response): Promise<void> {
  const ai: Ai = aiConfigFromEnvironment();
  const request: NewsletterIntroRequest = {
    events: isArray(req.body?.events) ? req.body.events : [],
    periodDescription: req.body?.periodDescription,
    groupName: req.body?.groupName,
    guidance: req.body?.guidance,
    purpose: req.body?.purpose
  };
  if (!request.events.length) {
    res.json({request: {}, response: {output: ""}});
  } else if (!ai.enabled) {
    res.status(503).json({request: {}, error: "AI is not enabled in this environment"});
  } else {
    try {
      const output = await generate(ai, systemPromptFor(request.purpose), buildNewsletterIntroInput(request));
      res.json({request: {}, response: {output}});
    } catch (error) {
      debug("newsletter-intro error:", error);
      res.status(502).json({request: {}, error: error?.message || String(error)});
    }
  }
}

export async function planNewsletter(req: Request, res: Response): Promise<void> {
  const ai: Ai = aiConfigFromEnvironment();
  const request: NewsletterPlanRequest = {request: (req.body?.request ?? "").toString()};
  const todayMillis = dateTimeNowAsValue();
  if (!request.request.trim()) {
    res.status(400).json({request: {}, error: "Describe the newsletter you want before it can be worked out"});
  } else if (!ai.enabled) {
    res.status(503).json({request: {}, error: "AI is not enabled in this environment"});
  } else {
    try {
      const output = await generate(ai, NEWSLETTER_PLAN_SYSTEM_PROMPT, buildNewsletterPlanInput(request, todayMillis));
      res.json({request: {}, response: parseNewsletterPlan(output, todayMillis)});
    } catch (error) {
      debug("newsletter-plan error:", error);
      res.status(502).json({request: {}, error: error?.message || String(error)});
    }
  }
}
