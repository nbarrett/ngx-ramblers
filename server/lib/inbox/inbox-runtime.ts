import debug from "debug";
import mongoose from "mongoose";
import { envConfig } from "../env-config/env-config";
import * as systemConfig from "../config/system-config";

const debugLog = debug(envConfig.logNamespace("inbox-runtime"));
debugLog.enabled = true;

async function collectionCount(collectionName: string, query: Record<string, unknown>): Promise<number> {
  const database = mongoose.connection.db;
  if (!database) {
    return 0;
  }
  const collections = await database.listCollections({name: collectionName}).toArray();
  if (collections.length === 0) {
    return 0;
  }
  return database.collection(collectionName).countDocuments(query);
}

export async function googleInboxConfigured(): Promise<boolean> {
  try {
    const config = await systemConfig.systemConfig();
    const googleInbox = config?.googleInbox;
    return !!(googleInbox?.clientId && googleInbox?.clientSecret && googleInbox?.redirectUri);
  } catch (error) {
    debugLog("Google Inbox config lookup failed:", error);
    return false;
  }
}

export async function inboxPollingEnabled(): Promise<boolean> {
  const [mailboxConnections, googleConfigured] = await Promise.all([
    collectionCount("inboxMailboxConnections", {enabled: true, oauthRefreshTokenEncrypted: {$ne: null}}),
    googleInboxConfigured()
  ]);
  const enabled = googleConfigured && mailboxConnections > 0;
  debugLog("polling check:", {mailboxConnections, googleConfigured, enabled});
  return enabled;
}
