import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import {checkedSyncPage, syncWalksManagerData} from "./walks-manager-sync";
import {RamblersEventsApiResponse} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {EventPopulation, SystemConfig} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import * as cache from "./walks-manager-cache";
import * as messages from "../shared/message-handlers";
import * as retries from "../shared/run-with-retries";
import * as defaults from "../ramblers/request-defaults";
import {dateTimeFromIso} from "../shared/dates";

const emptyPage = {apiStatusCode: 200, response: {data: [], summary: {offset: 0, count: 0, limit: 100, total: 0}}} as RamblersEventsApiResponse;

describe("Walks Manager sync response validation", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("accepts an explicitly successful complete empty page", () => {
    expect(checkedSyncPage(emptyPage, 0, 100)).toEqual(emptyPage.response);
  });

  [401, 429, 500].forEach(apiStatusCode => {
    it(`rejects a ${apiStatusCode} JSON error response`, () => {
      expect(() => checkedSyncPage({apiStatusCode, response: {error: "Upstream failed"}} as unknown as RamblersEventsApiResponse, 0, 100)).toThrow("unsuccessful");
    });
  });

  it("rejects a short page even when the upstream total says more events exist", () => {
    expect(() => checkedSyncPage({...emptyPage, response: {...emptyPage.response, summary: {...emptyPage.response.summary, total: 3}}}, 0, 100)).toThrow("incomplete");
  });

  it("does not delete cached walks after an upstream failure", async () => {
    sandbox.stub(messages, "httpRequest").resolves({apiStatusCode: 401, response: {error: "Invalid credentials"}});
    sandbox.stub(defaults, "createApiRequestOptions").returns({hostname: "api.example.org.uk"} as never);
    sandbox.stub(retries, "runWithRetries").callsFake(async operation => operation());
    sandbox.stub(cache, "cleanupDuplicatesByRamblersId").resolves({duplicatesRemoved: 0, ramblersIdsProcessed: 0, details: []});
    const remove = sandbox.stub(cache, "deleteStaleWalksManagerCache");
    const result = await syncWalksManagerData({group: {groupCode: "HS01", walkPopulation: EventPopulation.WALKS_MANAGER}} as SystemConfig,
      {dateFrom: dateTimeFromIso("2026-10-01"), dateTo: dateTimeFromIso("2026-10-02")});
    expect(result.errors.length).toBe(1);
    expect(remove.called).toBe(false);
  });
});
