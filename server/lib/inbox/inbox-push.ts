import { randomBytes } from "crypto";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { GoogleInboxConfig, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import * as config from "../mongo/controllers/config";
import { InboxPushEndpoint } from "./gmail-inbox.model";

export async function pushVerificationToken(): Promise<string | null> {
  return (await systemConfig())?.googleInbox?.pushVerificationToken ?? null;
}

export async function ensurePushVerificationToken(): Promise<string> {
  const current: SystemConfig = await systemConfig();
  if (!current) {
    throw new Error("System configuration is not initialised; cannot generate an inbox push token");
  }
  const existing = current.googleInbox?.pushVerificationToken;
  if (existing) {
    return existing;
  }
  const token = randomBytes(24).toString("hex");
  const googleInbox: GoogleInboxConfig = {
    clientId: current.googleInbox?.clientId ?? "",
    clientSecret: current.googleInbox?.clientSecret ?? "",
    redirectUri: current.googleInbox?.redirectUri ?? "",
    pushVerificationToken: token
  };
  await config.createOrUpdateKey(ConfigKey.SYSTEM, {...current, googleInbox});
  return token;
}

export async function pushReceiverUrl(): Promise<string | null> {
  const googleInbox = (await systemConfig())?.googleInbox;
  if (!googleInbox?.redirectUri || !googleInbox?.pushVerificationToken) {
    return null;
  }
  const origin = new URL(googleInbox.redirectUri).origin;
  return `${origin}${InboxPushEndpoint.RECEIVER_PATH}?token=${googleInbox.pushVerificationToken}`;
}
