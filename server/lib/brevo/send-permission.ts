import debug from "debug";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  CAMPAIGN_SEND_PURPOSES,
  MailConfig,
  PlatformSendControl,
  SEND_PURPOSE_DESCRIPTIONS,
  SendChannel,
  SendDecision,
  SendPurpose,
  SendRefusalReason,
  SendStatus,
  SYSTEM_SEND_PURPOSES
} from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { mailSendRefusal } from "../mongo/models/mail-send-refusal";
import { dateTimeNow } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("brevo:send-permission"));
debugLog.enabled = false;

export interface SendContext {
  subject?: string;
  recipientCount?: number;
  requestedBy?: string;
}

export class SendRefusedError extends Error {
  constructor(readonly purpose: SendPurpose, readonly reason: SendRefusalReason, message: string) {
    super(message);
    this.name = "SendRefusedError";
  }
}

export function channelFor(purpose: SendPurpose): SendChannel {
  return CAMPAIGN_SEND_PURPOSES.includes(purpose) ? SendChannel.CAMPAIGN : SendChannel.TRANSACTIONAL;
}

const allowed: SendDecision = {allowed: true, reason: null, message: null};

function refused(reason: SendRefusalReason, message: string): SendDecision {
  return {allowed: false, reason, message};
}

export function sendDecision(mailConfig: MailConfig | null, control: PlatformSendControl | null, purpose: SendPurpose): SendDecision {
  const description = SEND_PURPOSE_DESCRIPTIONS[purpose];
  if (control?.sendingSuspended) {
    const reasonSuffix = control.reason ? ` (${control.reason})` : "";
    return refused(SendRefusalReason.PLATFORM_SUSPENDED, `${description} refused: email sending on this site has been suspended by the platform administrator${reasonSuffix}.`);
  } else if (channelFor(purpose) === SendChannel.CAMPAIGN) {
    return mailConfig && mailConfig.allowSendCampaign === false
      ? refused(SendRefusalReason.CAMPAIGN_OFF, `${description} refused: Allow Send Campaign is switched off in Mail Settings.`)
      : allowed;
  } else if (mailConfig && mailConfig.allowSendTransactional === false) {
    const systemPurpose = SYSTEM_SEND_PURPOSES.includes(purpose);
    const systemEmailsStillAllowed = mailConfig.allowSystemEmailsWhenTransactionalOff !== false;
    return systemPurpose && systemEmailsStillAllowed
      ? allowed
      : refused(SendRefusalReason.TRANSACTIONAL_OFF, `${description} refused: Allow Send Transactional is switched off in Mail Settings.`);
  } else {
    return allowed;
  }
}

async function configValue<T>(configKey: ConfigKey): Promise<T | null> {
  try {
    const document = await config.queryKey(configKey);
    return (document?.value as T) || null;
  } catch (error: any) {
    debugLog("could not read", configKey, error?.message || error);
    return null;
  }
}

export function platformSendControl(): Promise<PlatformSendControl | null> {
  return configValue<PlatformSendControl>(ConfigKey.PLATFORM_SEND_CONTROL);
}

export async function sendAllowed(purpose: SendPurpose): Promise<SendDecision> {
  const [mailConfig, control] = await Promise.all([configValue<MailConfig>(ConfigKey.BREVO), platformSendControl()]);
  return sendDecision(mailConfig, control, purpose);
}

export async function recordRefusal(purpose: SendPurpose, decision: SendDecision, context: SendContext = {}): Promise<void> {
  try {
    await mailSendRefusal.create({
      purpose,
      channel: channelFor(purpose),
      reason: decision.reason,
      message: decision.message,
      subject: context.subject,
      recipientCount: context.recipientCount,
      requestedBy: context.requestedBy,
      refusedAt: dateTimeNow().toMillis()
    });
  } catch (error: any) {
    debugLog("could not record refusal for", purpose, error?.message || error);
  }
}

export async function assertSendAllowed(purpose: SendPurpose, context: SendContext = {}): Promise<void> {
  const decision = await sendAllowed(purpose);
  if (!decision.allowed) {
    debugLog("refused", purpose, decision.message, context);
    await recordRefusal(purpose, decision, context);
    throw new SendRefusedError(purpose, decision.reason, decision.message);
  }
}

export async function sendStatus(): Promise<SendStatus> {
  const [mailConfig, control] = await Promise.all([configValue<MailConfig>(ConfigKey.BREVO), platformSendControl()]);
  return {
    transactional: sendDecision(mailConfig, control, SendPurpose.BATCH),
    campaign: sendDecision(mailConfig, control, SendPurpose.CAMPAIGN_SEND),
    platformControl: control
  };
}
