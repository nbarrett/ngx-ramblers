import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import router from "./worker-templates/ngx-inbox-router.template";
import * as shared from "./worker-templates/shared";

const fallback = "fallback@example.com";
const routerEnv = {NGX_INBOUND_SECRET: "test-secret", NGX_FALLBACK_FORWARD: fallback};

describe("inbox router delivery", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => sandbox.stub(console, "error"));
  afterEach(() => sandbox.restore());

  function message() {
    return {
      to: "chair@group.example.org.uk",
      from: "sender@example.com",
      headers: new Headers(),
      raw: new Response("Subject: Test\r\n\r\nTest message").body,
      forward: sandbox.stub().resolves()
    };
  }

  it("accepts an explicit store acknowledgement without forwarding", async () => {
    const post = sandbox.stub(shared, "signAndPostWebhook").resolves(Response.json({response: {action: "store", stored: 1}}));
    const mail = message();
    await router.email(mail, routerEnv, null);
    expect(mail.forward.called).toBe(false);
    expect(post.firstCall.args[0]).toBe("https://group.example.org.uk/api/cloudflare/email-routing/inbound-inbox");
    expect(JSON.parse(post.firstCall.args[1]).envelopeTo).toBe(mail.to);
  });

  it("logs an unreachable webhook and forwards to the configured fallback", async () => {
    sandbox.stub(shared, "signAndPostWebhook").rejects(new Error("Connection refused"));
    const mail = message();
    await router.email(mail, routerEnv, null);
    expect(mail.forward.calledOnceWithExactly(fallback)).toBe(true);
    expect((console.error as sinon.SinonStub).firstCall.args[0]).toContain("webhook unreachable: Connection refused");
  });

  it("logs an HTTP failure before forwarding to the fallback", async () => {
    sandbox.stub(shared, "signAndPostWebhook").resolves(new Response("Signature rejected", {status: 401}));
    const mail = message();
    await router.email(mail, routerEnv, null);
    expect(mail.forward.calledOnceWithExactly(fallback)).toBe(true);
    expect((console.error as sinon.SinonStub).firstCall.args[0]).toContain("webhook returned 401");
  });

  it("does not mistake a successful HTML response for stored mail", async () => {
    sandbox.stub(shared, "signAndPostWebhook").resolves(new Response("<html>Site page</html>"));
    const mail = message();
    await router.email(mail, routerEnv, null);
    expect(mail.forward.calledOnceWithExactly(fallback)).toBe(true);
    expect((console.error as sinon.SinonStub).firstCall.args[0]).toContain("webhook response was not JSON");
  });

  it("does not mistake JSON without a delivery decision for stored mail", async () => {
    sandbox.stub(shared, "signAndPostWebhook").resolves(Response.json({response: {message: "Unexpected response"}}));
    const mail = message();
    await router.email(mail, routerEnv, null);
    expect(mail.forward.calledOnceWithExactly(fallback)).toBe(true);
    expect((console.error as sinon.SinonStub).firstCall.args[0]).toContain("unexpected action empty");
  });

  it("uses the fallback if an application-requested forwarding destination fails", async () => {
    sandbox.stub(shared, "signAndPostWebhook").resolves(Response.json({response: {action: "forward", to: ["recipient@example.com"]}}));
    const mail = message();
    mail.forward.onFirstCall().rejects(new Error("Destination unavailable"));
    await router.email(mail, routerEnv, null);
    expect(mail.forward.firstCall.args).toEqual(["recipient@example.com"]);
    expect(mail.forward.secondCall.args).toEqual([fallback]);
  });

  it("honours an explicit drop decision without forwarding", async () => {
    sandbox.stub(shared, "signAndPostWebhook").resolves(Response.json({response: {action: "drop"}}));
    const mail = message();
    await router.email(mail, routerEnv, null);
    expect(mail.forward.called).toBe(false);
  });

  it("throws if both webhook delivery and fallback forwarding fail", async () => {
    sandbox.stub(shared, "signAndPostWebhook").rejects(new Error("Connection refused"));
    const mail = message();
    mail.forward.rejects(new Error("Fallback unavailable"));
    await expect(router.email(mail, routerEnv, null)).rejects.toThrow("Fallback unavailable");
  });

  it("does not acknowledge and lose a message when the signing secret is missing", async () => {
    const mail = message();
    await expect(router.email(mail, {NGX_INBOUND_SECRET: ""}, null)).rejects.toThrow("NGX_INBOUND_SECRET not configured");
    expect(mail.forward.called).toBe(false);
  });
});
