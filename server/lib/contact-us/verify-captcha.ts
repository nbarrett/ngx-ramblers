import axios from "axios";
import { CaptchaVerificationResponse, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("verify-captcha"));
debugLog.enabled = false;

export async function verifyCaptcha(token: string): Promise<CaptchaVerificationResponse> {
  const config: SystemConfig = await systemConfig();
  const secretKey: string = config?.recaptcha?.secretKey;
  if (!token) {
    throw new Error("No token was passed to Captcha verification");
  } else  if (!secretKey) {
    throw new Error("Captcha configuration missing secret key");
  } else {
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`;
    try {
      const response = await axios.post<CaptchaVerificationResponse>(verificationUrl);
      return response.data;
    } catch (error) {
      debugLog("Captcha verification failed:", error);
      throw new Error(`Captcha verification failed. ${error.toString()}`);
    }
  }
}
