import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { startMailClientSmtp } from "./mail-client-smtp";
import { initialiseMailClientImapUids } from "./mail-client-imap-uid-hooks";
import { startMailClientImap } from "./mail-client-imap";
import { startMailClientSubmissionRecovery } from "./mail-client-submit";

const debugLog = debug(envConfig.logNamespace("mail-client:servers"));
debugLog.enabled = true;

export async function startMailClientServers(): Promise<void> {
  try {
    startMailClientSubmissionRecovery();
    startMailClientSmtp();
    startMailClientImap();
    await initialiseMailClientImapUids();
  } catch (error) {
    debugLog("failed to start mail client servers", (error as Error).message);
  }
}
