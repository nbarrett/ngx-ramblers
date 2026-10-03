import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { Request, Response } from "express";
import { DEFAULT_CMS_BASE_URL } from "./models";
import { versionReleases } from "./version-releases";

describe("versionReleases", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("loads the shared CMS feed and preserves its external links", async () => {
    const feed = {indexUrl: "https://group.example.org.uk/notes", entries: []};
    const fetchStub = sandbox.stub(globalThis, "fetch").resolves(new globalThis.Response(JSON.stringify(feed)));
    const response = {set: sandbox.stub(), json: sandbox.stub()};
    await versionReleases({query: {limit: "5"}} as unknown as Request, response as unknown as Response);
    expect(fetchStub.firstCall.args[0]).toEqual(`${DEFAULT_CMS_BASE_URL}/api/public/releases?limit=5`);
    expect(response.json.firstCall.args[0]).toEqual(feed);
  });

  it("reports an unavailable shared CMS without falling back to local content", async () => {
    const fetchStub = sandbox.stub(globalThis, "fetch").resolves(new globalThis.Response(null, {status: 503}));
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await versionReleases({query: {}} as Request, response as unknown as Response);
    expect(fetchStub.callCount).toEqual(1);
    expect(response.status.firstCall.args).toEqual([502]);
    expect(response.json.firstCall.args[0]).toEqual({message: "Shared release notes are unavailable"});
  });
});
