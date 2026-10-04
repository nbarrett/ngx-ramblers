import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Request, Response } from "express";
import * as config from "../mongo/controllers/config";
import * as environmentDetails from "../environment-setup/environment-details";
import * as dates from "../shared/dates";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { documentationSites, publicDocumentationSites } from "./documentation-sites";

const clock = {minutes: 0};
const sandbox = sinon.createSandbox();

describe("public documentation website directory", () => {
  beforeEach(() => {
    clock.minutes += 10;
    sandbox.stub(dates, "dateTimeNow").returns(dates.dateTimeFromIso("2026-10-01T12:00:00Z").plus({minutes: clock.minutes}));
  });

  afterEach(() => sandbox.restore());

  it("projects only public website fields and caches the directory", async () => {
    const query = sandbox.stub(config, "queryKey").resolves({key: ConfigKey.ENVIRONMENTS, value: {
      environments: [{environment: "hillside", mongo: {password: "private-password"}, flyio: {apiKey: "private-token"}}],
      cms: {password: "private-password"}
    }});
    sandbox.stub(environmentDetails, "environmentRamblersInfo").resolves({groupName: "Hillside Walkers", siteHref: "https://group.example.org.uk/"});
    const result = await publicDocumentationSites();
    expect(result).toEqual([{name: "hillside", label: "Hillside Walkers", url: "https://group.example.org.uk"}]);
    await publicDocumentationSites();
    expect(query.callCount).toBe(1);
  });

  it("uses this site's public details when no global directory exists", async () => {
    const query = sandbox.stub(config, "queryKey");
    query.withArgs(ConfigKey.ENVIRONMENTS).resolves(null);
    query.withArgs(ConfigKey.SYSTEM).resolves({key: ConfigKey.SYSTEM, value: {group: {shortName: "hillside", longName: "Hillside Walkers", href: "https://group.example.org.uk"}}});
    expect(await publicDocumentationSites()).toEqual([{name: "hillside", label: "Hillside Walkers", url: "https://group.example.org.uk"}]);
  });

  it("returns a generic error and allows a failed request to retry", async () => {
    const query = sandbox.stub(config, "queryKey");
    query.onFirstCall().rejects(new Error("Private configuration unavailable"));
    query.onSecondCall().resolves(null);
    query.onThirdCall().resolves({key: ConfigKey.SYSTEM, value: {group: {shortName: "hillside", longName: "Hillside Walkers", href: "https://group.example.org.uk"}}});
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await documentationSites({} as Request, response as unknown as Response);
    expect(response.status.calledWith(503)).toBe(true);
    expect(response.json.firstCall.args[0]).toEqual({error: "The website list is unavailable. Please try again."});
    expect(await publicDocumentationSites()).toHaveLength(1);
  });
});
