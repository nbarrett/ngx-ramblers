import expect from "expect";
import {afterEach, describe, it} from "mocha";
import sinon from "sinon";
import * as configuration from "../brevo-config";
import {campaignRecipients, recipientSelectorFor} from "./campaign-recipients";
import {parseRecipientExportCsv} from "./campaign-recipient-export";
import {HttpError} from "../../shared/http-error";

describe("campaign recipient reports", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("keeps bounces and undelivered recipients out of Delivered", () => {
    const rows = parseRecipientExportCsv([
      "Email,Delivered_Date,Hard_Bounce_Date,Soft_Bounce_Date",
      "alex.reed@example.com,01-10-2026 12:01:00,,",
      "jordan.blake@example.com,,01-10-2026 12:02:00,",
      "sam.lee@example.com,01-10-2026 12:03:00,,01-10-2026 12:04:00",
      "morgan.lane@example.com,,,"
    ].join("\n"));
    expect(rows.filter(recipientSelectorFor("delivered").select).map(row => row.email)).toEqual(["alex.reed@example.com"]);
    expect(rows.filter(recipientSelectorFor("hardBounces").select).map(row => row.email)).toEqual(["jordan.blake@example.com"]);
    expect(rows.filter(recipientSelectorFor("softBounces").select).map(row => row.email)).toEqual(["sam.lee@example.com"]);
  });

  it("rejects unsupported selectors including inherited object properties", () => {
    for (const type of ["constructor", "__proto__", "unknown"]) {
      expect(() => recipientSelectorFor(type)).toThrow("Unsupported recipient type");
    }
  });

  it("returns an HTTP error when starting an export fails", async () => {
    sandbox.stub(configuration, "brevoClient").rejects(new HttpError(502, "Export failed"));
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await campaignRecipients({params: {campaignId: "931"}, query: {type: "delivered"}} as any, response as any);
    expect(response.status.calledWith(502)).toBe(true);
    expect(response.json.calledOnce).toBe(true);
  });

  it("rejects invalid requests before contacting Brevo", async () => {
    const client = sandbox.stub(configuration, "brevoClient");
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await campaignRecipients({params: {campaignId: "-1"}, query: {type: "delivered"}} as any, response as any);
    await campaignRecipients({params: {campaignId: "932"}, query: {type: "unknown"}} as any, response as any);
    expect(client.called).toBe(false);
    expect(response.status.alwaysCalledWith(400)).toBe(true);
  });
});
