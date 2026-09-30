import { ConversionNextStep } from "../models/environment-setup.model";
import { hostFromUrl } from "./hosts";

export function conversionNextStep(options: {
  siteUrl: string;
  groupApex: string | null;
  extraMx: boolean;
  inboundReady: boolean;
  incomingRepairable: boolean;
}): ConversionNextStep {
  const siteHost = (hostFromUrl(options.siteUrl) || "").replace(/^www\./, "");
  const groupApex = (options.groupApex || "").replace(/^www\./, "");
  if (groupApex && siteHost && siteHost !== groupApex) {
    return ConversionNextStep.SET_SITE_URL;
  } else if (options.extraMx) {
    return ConversionNextStep.MOVE_INBOUND;
  } else if (!options.inboundReady && options.incomingRepairable) {
    return ConversionNextStep.ENABLE_INCOMING;
  } else {
    return ConversionNextStep.NONE;
  }
}

export function conversionNextStepTitle(step: ConversionNextStep): string {
  if (step === ConversionNextStep.SET_SITE_URL) {
    return "Next: set the Site URL to the group domain";
  } else if (step === ConversionNextStep.MOVE_INBOUND) {
    return "Next: move inbound mail onto the NGX estate";
  } else if (step === ConversionNextStep.MOVE_MAIL) {
    return "Next: move mail to the group domain";
  } else if (step === ConversionNextStep.ENABLE_INCOMING) {
    return "Next: enable incoming mail";
  } else {
    return "";
  }
}

export function conversionNextStepBody(step: ConversionNextStep): string {
  if (step === ConversionNextStep.SET_SITE_URL) {
    return "Use Set as Site URL on the group domain row. If CMS images still load from that hostname, run Content Migration first while the old host still answers.";
  } else if (step === ConversionNextStep.MOVE_INBOUND) {
    return "This replaces StackMail or other non-Cloudflare MX with Cloudflare Email Routing. Use Move mail further down if committee From addresses still need rewriting onto the group domain.";
  } else if (step === ConversionNextStep.MOVE_MAIL) {
    return "Rewrites committee From addresses onto the group domain and takes inbound MX onto Cloudflare Email Routing.";
  } else if (step === ConversionNextStep.ENABLE_INCOMING) {
    return "MX is already Cloudflare. This turns Email Routing on without replacing MX.";
  } else {
    return "";
  }
}
