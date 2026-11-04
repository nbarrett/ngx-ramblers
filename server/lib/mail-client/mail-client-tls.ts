import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { Request, Response } from "express";
import { SecureContextOptions } from "tls";
import { Client, crypto, directory } from "acme-client";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { mailClientHostname } from "./mail-client-auth";
import { dateTimeFromJsDate, dateTimeNow } from "../shared/dates";
import { decryptJsonConfig, encryptJsonConfig } from "../shared/config-crypto";
import { isLocalMailClientHost } from "../../../projects/ngx-ramblers/src/app/functions/mail-client-connection";
import { MailClientTlsCredentials } from "./mail-client-tls.model";
import { booleanOf } from "../shared/string-utils";
import { acquireMailClientCertificateLease, expireMailClientChallenge, mailClientChallenge, releaseMailClientCertificateLease, saveMailClientCertificate, saveMailClientChallenge, storedMailClientCertificate } from "./mail-client-tls-store";

const debugLog = debug(envConfig.logNamespace("mail-client:tls"));
debugLog.enabled = true;

export async function serveMailClientAcmeChallenge(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.params.token || "");
    const challenge = /^[A-Za-z0-9_-]{1,256}$/.test(token) ? await mailClientChallenge(token) : null;
    if (challenge) {
      res.type("text/plain").send(challenge.keyAuthorization);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    debugLog("ACME challenge lookup failed", (error as Error).message);
    res.sendStatus(503);
  }
}

export async function mailClientTlsOptions(): Promise<SecureContextOptions | null> {
  const hostname = await mailClientHostname();
  if (isLocalMailClientHost(hostname) || !booleanOf(envConfig.value(Environment.MAIL_CLIENT_NATIVE_TLS))) {
    return null;
  } else {
    const stored = await storedMailClientCertificate(hostname);
    const secret = envConfig.auth().secret;
    const existing = stored ? decryptJsonConfig<MailClientTlsCredentials>(stored.encryptedCredentials, secret) : null;
    if (existing && stored.expiresAt > dateTimeNow().plus({days: 30}).toMillis()) {
      return {key: existing.privateKey, cert: existing.certificate};
    } else {
      try {
        const credentials = await issueMailClientCertificate(hostname, existing, secret);
        return {key: credentials.privateKey, cert: credentials.certificate};
      } catch (error) {
        if (existing && stored.expiresAt > dateTimeNow().toMillis()) {
          debugLog("Certificate renewal failed; retaining the current valid certificate", (error as Error).message);
          return {key: existing.privateKey, cert: existing.certificate};
        } else {
          throw error;
        }
      }
    }
  }
}

async function issueMailClientCertificate(hostname: string, existing: MailClientTlsCredentials | null, secret: string): Promise<MailClientTlsCredentials> {
  const owner = await acquireMailClientCertificateLease(hostname);
  try {
    const accountKey = existing?.accountKey || (await crypto.createPrivateKey()).toString();
    const client = new Client({directoryUrl: directory.letsencrypt.production, accountKey});
    const [privateKey, csr] = await crypto.createCsr({commonName: hostname});
    const certificate = await client.auto({
      csr,
      termsOfServiceAgreed: true,
      challengePriority: ["http-01"],
      challengeCreateFn: async (_authorisation, challenge, keyAuthorization) => saveMailClientChallenge(challenge.token, keyAuthorization),
      challengeRemoveFn: async (_authorisation, challenge) => expireMailClientChallenge(challenge.token)
    });
    debugLog("Mail certificate issued for the configured site hostname");
    const credentials = {accountKey, privateKey: privateKey.toString(), certificate};
    await saveMailClientCertificate({
      _id: hostname,
      encryptedCredentials: encryptJsonConfig(credentials, secret),
      expiresAt: dateTimeFromJsDate(crypto.readCertificateInfo(certificate).notAfter).toMillis()
    });
    return credentials;
  } finally {
    await releaseMailClientCertificateLease(hostname, owner);
  }
}
