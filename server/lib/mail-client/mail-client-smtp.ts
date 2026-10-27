import { SMTPServer, SMTPServerAuthentication, SMTPServerAuthenticationResponse, SMTPServerSession } from "smtp-server";
import { Readable } from "stream";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { authenticateMailClient } from "./mail-client-credentials";
import { MailClientSubmitError, submitMailClientMessage } from "./mail-client-submit";
import { mailClientAccessEnabled } from "./mail-client-auth";
import { smtpSubmissionPort } from "./mail-client-ports";

const debugLog = debug(envConfig.logNamespace("mail-client:smtp"));
debugLog.enabled = true;

export function startMailClientSmtp(): SMTPServer {
  const port = smtpSubmissionPort();
  const server = new SMTPServer({
    banner: "NGX committee mail",
    authOptional: false,
    secure: false,
    allowInsecureAuth: true,
    disabledCommands: ["STARTTLS"],
    hideSTARTTLS: true,
    size: 15 * 1024 * 1024,
    onConnect(session, callback) {
      debugLog("SMTP connect from", session.remoteAddress);
      mailClientAccessEnabled().then(enabled => {
        if (enabled) {
          debugLog("SMTP accepted", session.remoteAddress);
          callback();
        } else {
          debugLog("SMTP rejected: mail application access is switched off", session.remoteAddress);
          callback(new Error("Mail application access is switched off"));
        }
      }).catch(error => {
        debugLog("SMTP connect error", (error as Error).message);
        callback(error as Error);
      });
    },
    onAuth(auth: SMTPServerAuthentication, _session: SMTPServerSession, callback: (error: Error | null, response?: SMTPServerAuthenticationResponse) => void) {
      debugLog("SMTP AUTH user", auth.username);
      authenticateMailClient(auth.username || "", auth.password || "").then(member => {
        if (member) {
          debugLog("SMTP AUTH ok", auth.username);
          callback(null, {user: member});
        } else {
          debugLog("SMTP AUTH failed", auth.username);
          callback(new Error("Invalid username or application password"));
        }
      }).catch(error => {
        debugLog("SMTP AUTH error", (error as Error).message);
        callback(error as Error);
      });
    },
    onData(stream: Readable, session: SMTPServerSession, callback: (error?: Error | null) => void) {
      const chunks: Buffer[] = [];
      stream.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on("error", error => callback(error));
      stream.on("end", () => {
        const member = session.user as {id?: string} | undefined;
        if (!member?.id) {
          callback(new Error("Not authenticated"));
        } else {
          submitMailClientMessage(member as never, Buffer.concat(chunks as unknown as Uint8Array[]))
            .then(() => callback())
            .catch(error => {
              const submitError = error as MailClientSubmitError;
              debugLog("submit failed", submitError.message);
              callback(submitError);
            });
        }
      });
    }
  });
  server.listen(port, () => debugLog(`SMTP submission listening on ${port}`));
  server.on("error", error => debugLog("SMTP server error", (error as Error).message));
  return server;
}
