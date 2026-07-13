import expect from "expect";
import { describe, it } from "mocha";
import { EmailForwardingMode } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { generateRouterWorkerScript, generateWorkerScript } from "./cloudflare-email-workers";

const webhookHelperNames = ["hmacSign", "encodeRawMimeBase64", "signAndPostWebhook"];

function expectSelfContainedWebhookWorker(script: string): void {
  expect(script).not.toMatch(/^\s*import\s/m);
  webhookHelperNames.forEach(name => {
    expect(script.match(new RegExp(`function ${name}\\b`, "g"))?.length).toBe(1);
  });
}

describe("cloudflare email workers", () => {
  it("generates a self-contained shared inbox router", () => {
    expectSelfContainedWebhookWorker(generateRouterWorkerScript());
  });

  it("generates a self-contained direct inbox worker", () => {
    expectSelfContainedWebhookWorker(generateWorkerScript([], EmailForwardingMode.NGX_INBOX, {
      webhookUrl: "https://example.com/api/cloudflare/email-routing/inbound-inbox"
    }));
  });

  it("generates a self-contained Brevo resend worker", () => {
    expectSelfContainedWebhookWorker(generateWorkerScript(["recipient@example.com"], EmailForwardingMode.BREVO_RESEND, {
      roleEmail: "role@example.com",
      roleName: "Role",
      webhookUrl: "https://example.com/api/cloudflare/email-routing/inbound-mime"
    }));
  });
});
