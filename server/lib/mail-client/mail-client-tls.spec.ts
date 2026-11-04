import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Client, crypto } from "acme-client";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import * as system from "../config/system-config";
import * as store from "./mail-client-tls-store";
import { mailClientTlsOptions, serveMailClientAcmeChallenge } from "./mail-client-tls";
import { dateTimeNow } from "../shared/dates";
import { decryptJsonConfig, encryptJsonConfig } from "../shared/config-crypto";
import { MailClientTlsCredentials } from "./mail-client-tls.model";

const credentials: MailClientTlsCredentials = {accountKey: "fictional-account-key", privateKey: "fictional-private-key", certificate: "fictional-certificate"};
const secret = "fictional-certificate-encryption-secret";

describe("native mail TLS certificates", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(system, "systemConfig").resolves({group: {href: "https://group.example.org.uk"}} as any);
    sandbox.stub(envConfig, "auth").returns({secret} as any);
    sandbox.stub(envConfig, "value").withArgs(Environment.MAIL_CLIENT_NATIVE_TLS).returns("true");
    sandbox.stub(store, "storedMailClientCertificate").resolves(null);
    sandbox.stub(store, "saveMailClientCertificate").resolves();
    sandbox.stub(store, "acquireMailClientCertificateLease").resolves("fictional-lease");
    sandbox.stub(store, "releaseMailClientCertificateLease").resolves();
    sandbox.stub(store, "saveMailClientChallenge").resolves();
    sandbox.stub(store, "expireMailClientChallenge").resolves();
    sandbox.stub(crypto, "createPrivateKey").resolves(Buffer.from(credentials.accountKey));
    sandbox.stub(crypto, "createCsr").resolves([Buffer.from(credentials.privateKey), Buffer.from("fictional-csr")]);
    sandbox.stub(crypto, "readCertificateInfo").returns({notAfter: dateTimeNow().plus({days: 90}).toJSDate()} as any);
    sandbox.stub(Client.prototype, "auto").resolves(credentials.certificate);
  });
  afterEach(() => sandbox.restore());

  function existing(days: number): void {
    (store.storedMailClientCertificate as sinon.SinonStub).resolves({
      _id: "group.example.org.uk",
      expiresAt: dateTimeNow().plus({days}).toMillis(),
      encryptedCredentials: encryptJsonConfig(credentials, secret)
    });
  }

  it("keeps local development on its existing plaintext listeners", async () => {
    (system.systemConfig as sinon.SinonStub).resolves({group: {href: "http://localhost:4200"}});
    expect(await mailClientTlsOptions()).toBeNull();
    expect((store.storedMailClientCertificate as sinon.SinonStub).called).toBe(false);
  });

  it("preserves proxy TLS on environments that have not enabled native TLS", async () => {
    (envConfig.value as sinon.SinonStub).withArgs(Environment.MAIL_CLIENT_NATIVE_TLS).returns("");
    expect(await mailClientTlsOptions()).toBeNull();
    expect((store.storedMailClientCertificate as sinon.SinonStub).called).toBe(false);
  });

  it("reuses a valid encrypted certificate without contacting the certificate authority", async () => {
    existing(60);
    expect(await mailClientTlsOptions()).toEqual({key: credentials.privateKey, cert: credentials.certificate});
    expect((Client.prototype.auto as sinon.SinonStub).called).toBe(false);
  });

  it("accepts the shared boolean formats for the native TLS flag", async () => {
    existing(60);
    for (const value of ["TRUE", " yes ", "1"]) {
      (envConfig.value as sinon.SinonStub).withArgs(Environment.MAIL_CLIENT_NATIVE_TLS).returns(value);
      expect(await mailClientTlsOptions()).toEqual({key: credentials.privateKey, cert: credentials.certificate});
    }
  });

  it("publishes expiring HTTP challenges and persists only encrypted private credentials", async () => {
    (Client.prototype.auto as sinon.SinonStub).callsFake(async options => {
      const challenge = {token: "fictional-token"};
      await options.challengeCreateFn(null, challenge, "fictional-authorisation");
      await options.challengeRemoveFn(null, challenge, "fictional-authorisation");
      return credentials.certificate;
    });
    expect(await mailClientTlsOptions()).toEqual({key: credentials.privateKey, cert: credentials.certificate});
    const saved = (store.saveMailClientCertificate as sinon.SinonStub).firstCall.args[0];
    expect(saved._id).toBe("group.example.org.uk");
    expect(saved.encryptedCredentials).not.toContain(credentials.privateKey);
    expect(decryptJsonConfig(saved.encryptedCredentials, secret)).toEqual(credentials);
    expect((store.saveMailClientChallenge as sinon.SinonStub).calledOnceWithExactly("fictional-token", "fictional-authorisation")).toBe(true);
    expect((store.expireMailClientChallenge as sinon.SinonStub).calledOnceWithExactly("fictional-token")).toBe(true);
    expect((store.releaseMailClientCertificateLease as sinon.SinonStub).calledOnceWithExactly("group.example.org.uk", "fictional-lease")).toBe(true);
  });

  it("retains a still-valid certificate if renewal fails and releases the issuance lease", async () => {
    existing(10);
    (Client.prototype.auto as sinon.SinonStub).rejects(new Error("Certificate authority unavailable"));
    expect(await mailClientTlsOptions()).toEqual({key: credentials.privateKey, cert: credentials.certificate});
    expect((store.releaseMailClientCertificateLease as sinon.SinonStub).calledOnce).toBe(true);
    expect((store.saveMailClientCertificate as sinon.SinonStub).called).toBe(false);
  });

  it("does not start an insecure public listener when certificate issuance fails", async () => {
    (Client.prototype.auto as sinon.SinonStub).rejects(new Error("Certificate authority unavailable"));
    await expect(mailClientTlsOptions()).rejects.toThrow("Certificate authority unavailable");
    expect((store.releaseMailClientCertificateLease as sinon.SinonStub).calledOnce).toBe(true);
  });

  it("serves only an active validation token and rejects invalid paths without a database lookup", async () => {
    const lookup = sandbox.stub(store, "mailClientChallenge").resolves({_id: "fictional-token", keyAuthorization: "fictional-authorisation", expiresAt: dateTimeNow().plus({minutes: 1}).toMillis()});
    const res = {type: sandbox.stub().returnsThis(), send: sandbox.spy(), sendStatus: sandbox.spy()};
    await serveMailClientAcmeChallenge({params: {token: "fictional-token"}} as unknown as Request, res as unknown as Response);
    expect(res.send.calledOnceWithExactly("fictional-authorisation")).toBe(true);
    await serveMailClientAcmeChallenge({params: {token: "../private-key"}} as unknown as Request, res as unknown as Response);
    expect(res.sendStatus.calledOnceWithExactly(404)).toBe(true);
    expect(lookup.calledOnce).toBe(true);
  });
});
