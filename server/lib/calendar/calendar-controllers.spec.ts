import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Request, Response } from "express";
import * as config from "../config/system-config";
import { member } from "../mongo/models/member";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { eventsCalendarFeed } from "./calendar-controllers";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { EventField, GroupEventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { RamblersEventType, WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

describe("eventsCalendarFeed", () => {
  const sandbox = sinon.createSandbox();
  const memberId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const response = {setHeader: sinon.stub(), send: sinon.stub(), status: sinon.stub(), json: sinon.stub()};
  const eventQuery = {select: sinon.stub(), sort: sinon.stub(), limit: sinon.stub(), lean: sinon.stub(), exec: sinon.stub()};

  beforeEach(() => {
    response.status.returns(response);
    eventQuery.select.returns(eventQuery);
    eventQuery.sort.returns(eventQuery);
    eventQuery.limit.returns(eventQuery);
    eventQuery.lean.returns(eventQuery);
    eventQuery.exec.resolves([]);
    sandbox.stub(config, "systemConfig").resolves({group: {shortName: "Hillside", href: "https://group.example.org.uk"}} as SystemConfig);
    sandbox.stub(extendedGroupEvent, "find").returns(eventQuery as any);
  });

  afterEach(() => {
    sandbox.restore();
    response.status.resetHistory();
    response.send.resetHistory();
  });

  function request(id: string | null): Request {
    return {params: id ? {memberId: id} : {}, headers: {}, protocol: "https", get: () => "group.example.org.uk"} as unknown as Request;
  }

  it("limits a personal feed to published walks matching the member or contact ID", async () => {
    const memberQuery = {select: sinon.stub(), lean: sinon.stub(), exec: sinon.stub().resolves({contactId: "contact-example"})};
    memberQuery.select.returns(memberQuery);
    memberQuery.lean.returns(memberQuery);
    sandbox.stub(member, "findById").returns(memberQuery as any);
    await eventsCalendarFeed(request(memberId), response as unknown as Response);
    const criteria = (extendedGroupEvent.find as sinon.SinonStub).firstCall.args[0];
    expect(criteria.$or).toEqual([
      {[EventField.CONTACT_DETAILS_MEMBER_ID]: {$in: [memberId, "contact-example"]}},
      {[GroupEventField.WALK_LEADER_ID]: {$in: [memberId, "contact-example"]}}
    ]);
    expect(criteria[GroupEventField.ITEM_TYPE]).toBe(RamblersEventType.GROUP_WALK);
    expect(criteria[GroupEventField.STATUS].$nin).toContain(WalkStatus.DRAFT);
    expect(response.send.calledOnce).toBe(true);
  });

  it("does not fall back to everyone's feed when the member does not exist", async () => {
    await eventsCalendarFeed(request("invalid-member"), response as unknown as Response);
    expect(response.status.calledWith(404)).toBe(true);
    expect((extendedGroupEvent.find as sinon.SinonStub).called).toBe(false);
    expect(response.send.called).toBe(false);
  });

  it("keeps the existing whole-group feed unrestricted by leader", async () => {
    await eventsCalendarFeed(request(null), response as unknown as Response);
    const criteria = (extendedGroupEvent.find as sinon.SinonStub).firstCall.args[0];
    expect(criteria.$or).toBeUndefined();
    expect(criteria[GroupEventField.ITEM_TYPE]).toBeUndefined();
    expect(response.send.calledOnce).toBe(true);
  });
});
