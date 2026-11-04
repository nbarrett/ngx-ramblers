import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { crypto, Authorization } from "acme-client";
import tls, { SecureContextOptions, TLSSocket } from "tls";
import { AddressInfo, Server } from "net";
import { once } from "events";
import * as ports from "./mail-client-ports";
import * as access from "./mail-client-auth";
import { startMailClientImap } from "./mail-client-imap";
import { startMailClientSmtp } from "./mail-client-smtp";
import { MailClientProtocol } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";

describe("native mail TLS negotiation", function () {
  this.timeout(20000);
  const sandbox = sinon.createSandbox();
  const state = {imap: null as Server, smtp: null as ReturnType<typeof startMailClientSmtp>, options: null as SecureContextOptions, clients: [] as TLSSocket[]};

  beforeEach(async () => {
    const [key, cert] = await crypto.createAlpnCertificate({identifier: {type: "dns", value: "group.example.org.uk"}} as Authorization, "fictional-authorisation");
    state.options = {key, cert};
    sandbox.stub(ports, "imapListenPort").returns(0);
    sandbox.stub(ports, "smtpSubmissionPort").returns(0);
    sandbox.stub(access, "mailClientAccessEnabled").resolves(true);
    state.imap = startMailClientImap(state.options);
    state.smtp = startMailClientSmtp(state.options);
    await Promise.all([once(state.imap, "listening"), once(state.smtp.server, "listening")]);
  });

  afterEach(async () => {
    const closed = state.clients.map(client => once(client, "close"));
    state.clients.forEach(client => client.destroy());
    await Promise.all(closed);
    state.clients = [];
    await Promise.all([
      new Promise<void>((resolve, reject) => state.imap.close(error => error ? reject(error) : resolve())),
      new Promise<void>(resolve => state.smtp.close(resolve))
    ]);
    sandbox.restore();
  });

  for (const protocol of [MailClientProtocol.IMAP, MailClientProtocol.SMTP]) {
    it(`accepts Apple Mail's ${protocol} ALPN offer and returns the protocol greeting`, async () => {
      const server = protocol === MailClientProtocol.IMAP ? state.imap : state.smtp.server;
      const client = tls.connect({host: "127.0.0.1", port: (server.address() as AddressInfo).port, servername: "group.example.org.uk", rejectUnauthorized: false, ALPNProtocols: [protocol]});
      state.clients.push(client);
      await once(client, "secureConnect");
      expect(client.alpnProtocol).toBe(protocol === MailClientProtocol.IMAP ? protocol : false);
      const [greeting] = await once(client, "data");
      expect(greeting.toString()).toMatch(protocol === MailClientProtocol.IMAP ? /^\* OK NGX IMAP ready/ : /^220 /);
    });
  }
});
