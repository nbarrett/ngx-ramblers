import { Request, Response } from "express";
import {
  ContactFormDetails,
  ValidateTokenRequest
} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { CaptchaVerificationResponse } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { verifyCaptcha } from "./verify-captcha";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("contact-us"));
debugLog.enabled = true;

export async function validateTokenRequest(req: Request, res: Response): Promise<void> {
  const validateTokenRequest: ValidateTokenRequest = req.body;
  const validated = await validateToken(validateTokenRequest.captchaToken, res);
  if (validated) {
    debugLog("Contact form details:", validateTokenRequest);
    res.status(200).json({message: "Contact form submitted successfully"});
  }
}

async function validateToken(token: string, res: Response) {
  try {
    const result: CaptchaVerificationResponse = await verifyCaptcha(token);
    if (result.success) {
      debugLog("Captcha verified successfully:result", result);
      return true;
    } else {
      debugLog("Captcha verification failed:result", result);
      res.status(500).json({message: "Captcha verification failed", error: result["error-codes"]});
      return false;
    }
  } catch (error) {
    res.status(500).json({message: "Error verifying captcha", error: error.toString()});
    debugLog("Error verifying captcha:", error);
    return false;
  }
}

