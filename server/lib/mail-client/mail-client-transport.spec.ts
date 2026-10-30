import expect from "expect";
import {afterEach, beforeEach, describe, it} from "mocha";
import sinon from "sinon";
import {readFileSync} from "fs";
import * as config from "../mongo/controllers/config";
import * as system from "../config/system-config";
import {envConfig} from "../env-config/env-config";
import {ConfigKey} from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {Environment} from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {Member} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {connectionSettingsFor} from "./mail-client-auth";
import {imapListenPort, smtpSubmissionPort} from "./mail-client-ports";
import {resolveClientPath} from "../shared/path-utils";
import {SMTPServer} from "smtp-server";
import {startMailClientSmtp} from "./mail-client-smtp";

describe("mail client transport", () => {
  const sandbox = sinon.createSandbox();
  const originalEnvironment = {
    appName: process.env[Environment.FLY_APP_NAME],
    smtpPort: process.env.SMTP_SUBMISSION_PORT,
    imapPort: process.env.IMAP_PORT
  };
  const member = {id: "member-1", userName: "alex.reed"} as Member;

  beforeEach(() => {
    delete process.env[Environment.FLY_APP_NAME];
    delete process.env.SMTP_SUBMISSION_PORT;
    delete process.env.IMAP_PORT;
    const query = sandbox.stub(config, "queryKey");
    query.withArgs(ConfigKey.BREVO).resolves({value: {allowMailClientAccess: true}} as never);
    query.withArgs(ConfigKey.COMMITTEE).resolves({value: {roles: []}} as never);
    sandbox.stub(system, "systemConfig").resolves({group: {href: "https://group.example.org.uk"}} as never);
  });

  afterEach(() => {
    sandbox.restore();
    if (originalEnvironment.appName) {
      process.env[Environment.FLY_APP_NAME] = originalEnvironment.appName;
    } else {
      delete process.env[Environment.FLY_APP_NAME];
    }
    if (originalEnvironment.smtpPort) {
      process.env.SMTP_SUBMISSION_PORT = originalEnvironment.smtpPort;
    } else {
      delete process.env.SMTP_SUBMISSION_PORT;
    }
    if (originalEnvironment.imapPort) {
      process.env.IMAP_PORT = originalEnvironment.imapPort;
    } else {
      delete process.env.IMAP_PORT;
    }
  });

  it("advertises implicit TLS public ports independently of internal listener overrides", async () => {
    sandbox.stub(envConfig, "production").value(true);
    process.env.SMTP_SUBMISSION_PORT = "11587";
    process.env.IMAP_PORT = "11993";
    const settings = await connectionSettingsFor(member);
    expect(settings).toMatchObject({host: "group.example.org.uk", smtpPort: 465, imapPort: 993, smtpSecure: true, imapSecure: true});
    expect(smtpSubmissionPort()).toEqual(11587);
    expect(imapListenPort()).toEqual(11993);
  });

  it("prefers the configured public hostname over the Fly application hostname", async () => {
    sandbox.stub(envConfig, "production").value(true);
    process.env[Environment.FLY_APP_NAME] = "example-group";
    expect((await connectionSettingsFor(member)).host).toEqual("group.example.org.uk");
  });

  it("falls back to the Fly hostname when no public site address is configured", async () => {
    sandbox.stub(envConfig, "production").value(true);
    process.env[Environment.FLY_APP_NAME] = "example-group";
    (system.systemConfig as sinon.SinonStub).resolves({group: {href: ""}});
    expect((await connectionSettingsFor(member)).host).toEqual("example-group.fly.dev");
  });

  it("shows the public mail server and TLS ports when the website runs locally", async () => {
    sandbox.stub(envConfig, "production").value(false);
    process.env[Environment.FLY_APP_NAME] = "example-group";
    process.env.SMTP_SUBMISSION_PORT = "11587";
    process.env.IMAP_PORT = "11993";
    expect(await connectionSettingsFor(member)).toMatchObject({host: "group.example.org.uk", smtpPort: 465, imapPort: 993, smtpSecure: true, imapSecure: true});
  });

  it("uses local listener settings only when the configured site itself is localhost", async () => {
    sandbox.stub(envConfig, "production").value(false);
    (system.systemConfig as sinon.SinonStub).resolves({group: {href: "http://localhost:4200"}});
    const settings = await connectionSettingsFor(member);
    expect(settings).toMatchObject({host: "localhost", smtpPort: 1587, imapPort: 1993, smtpSecure: false, imapSecure: false});
  });

  it("accepts authenticated SMTP on the internal listener after the proxy terminates TLS", () => {
    const listen = sandbox.stub(SMTPServer.prototype, "listen").returnsThis();
    const server = startMailClientSmtp();
    expect(server.options).toMatchObject({secure: false, authOptional: false, allowInsecureAuth: true, hideSTARTTLS: true, disabledCommands: ["STARTTLS"]});
    expect(listen.firstCall.args[0]).toEqual(1587);
  });

  it("exposes only TLS mail ports through the shared Fly deployment configuration", () => {
    const configuration = readFileSync(resolveClientPath("fly.toml"), "utf8");
    const services = configuration.split("[[services]]").slice(1);
    expect(services).toHaveLength(2);
    expect(services[0]).toMatch(/internal_port\s*=\s*1587/);
    expect(services[0]).toMatch(/\bport\s*=\s*465/);
    expect(services[1]).toMatch(/internal_port\s*=\s*1993/);
    expect(services[1]).toMatch(/\bport\s*=\s*993/);
    services.forEach(service => expect(service).toMatch(/handlers\s*=\s*\["tls"\]/));
  });
});
