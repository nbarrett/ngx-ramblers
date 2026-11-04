import debug from "debug";
import { Server as TlsServer } from "tls";
import { envConfig } from "../env-config/env-config";
import { startMailClientSmtp } from "./mail-client-smtp";
import { initialiseMailClientImapUids } from "./mail-client-imap-uid-hooks";
import { startMailClientImap } from "./mail-client-imap";
import { startMailClientSubmissionRecovery } from "./mail-client-submit";
import { mailClientAccessEnabled } from "./mail-client-auth";
import { mailClientTlsOptions } from "./mail-client-tls";

const debugLog = debug(envConfig.logNamespace("mail-client:servers"));
debugLog.enabled = true;
const initialisation = {pending: false, started: false, retry: null as ReturnType<typeof setInterval> | null};

export async function startMailClientServers(): Promise<void> {
  if (!initialisation.pending && !initialisation.started) {
    initialisation.pending = true;
    try {
      if (await mailClientAccessEnabled()) {
        const options = await mailClientTlsOptions();
        startMailClientSubmissionRecovery();
        const smtp = startMailClientSmtp(options);
        const imap = startMailClientImap(options);
        initialisation.started = true;
        const renewal = setInterval(() => {
          mailClientTlsOptions().then(renewed => {
            if (renewed && imap instanceof TlsServer) {
              imap.setSecureContext(renewed);
              smtp.updateSecureContext(renewed);
            }
          }).catch(error => debugLog("Mail certificate renewal failed", (error as Error).message));
        }, 60 * 60 * 1000);
        renewal.unref();
        await initialiseMailClientImapUids();
      }
    } catch (error) {
      debugLog("failed to start mail client servers", (error as Error).message);
    } finally {
      initialisation.pending = false;
      if (initialisation.started && initialisation.retry) {
        clearInterval(initialisation.retry);
        initialisation.retry = null;
      } else if (!initialisation.started && !initialisation.retry) {
        initialisation.retry = setInterval(() => {
          startMailClientServers().catch(error => debugLog("Mail server initialisation failed", (error as Error).message));
        }, 60000);
        initialisation.retry.unref();
      }
    }
  }
}
