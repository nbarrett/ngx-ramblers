import expect from "expect";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import { EmailForwardingMode } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { generateRouterWorkerScript, generateWorkerScript, transpileWorkerTemplate, uploadWorkerScript } from "./cloudflare-email-workers";

const webhookHelperNames = ["hmacSign", "encodeRawMimeBase64", "signAndPostWebhook"];

function expectSelfContainedWebhookWorker(script: string): void {
  expect(script).not.toMatch(/^\s*import\s/m);
  webhookHelperNames.forEach(name => {
    expect(script.match(new RegExp(`function ${name}\\b`, "g"))?.length).toBe(1);
  });
}

describe("cloudflare email workers", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("preserves existing secret bindings when publishing worker code", async () => {
    const request = sandbox.stub(global, "fetch").resolves(Response.json({success: true, result: {id: "worker-1"}}));
    await uploadWorkerScript({accountId: "account-1", apiToken: "token"} as any, "email-inbox-router-group-example-org-uk", "export default {};");
    const form = request.firstCall.args[1].body as FormData;
    const metadata = JSON.parse(await (form.get("metadata") as Blob).text());
    expect(metadata.keep_bindings).toEqual(["secret_text"]);
  });

  it("generates a self-contained shared inbox router", () => {
    const script = generateRouterWorkerScript();
    expectSelfContainedWebhookWorker(script);
    expect(script).toContain("redirect: \"manual\"");
  });

  it("generates a self-contained direct inbox worker", () => {
    expectSelfContainedWebhookWorker(generateWorkerScript([], EmailForwardingMode.NGX_INBOX, {
      webhookUrl: "https://example.com/api/cloudflare/email-routing/inbound-inbox"
    }));
  });

  it("generates a self-contained public site fetch worker", () => {
    const script = transpileWorkerTemplate("public-site-fetch");
    expect(script).not.toMatch(/^\s*import\s/m);
    expect(script).toContain("X-Public-Site-Status");
    expect(script).toContain("PUBLIC_SITE_FETCH_SECRET");
  });

  it("generates a self-contained Brevo resend worker", () => {
    expectSelfContainedWebhookWorker(generateWorkerScript(["recipient@example.com"], EmailForwardingMode.BREVO_RESEND, {
      roleEmail: "role@example.com",
      roleName: "Role",
      webhookUrl: "https://example.com/api/cloudflare/email-routing/inbound-mime"
    }));
  });
});
