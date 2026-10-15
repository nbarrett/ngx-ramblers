import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { ChangeDetectorRef } from "@angular/core";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { DisplayedWalk, EventField, GroupEventField, LinkSource, WalkCopyOption } from "../../../models/walk.model";
import { WalkEditCopyFromComponent } from "./walk-edit-copy-from";

describe("walk copy searches", () => {
  function component(): WalkEditCopyFromComponent {
    const view = Object.create(WalkEditCopyFromComponent.prototype) as WalkEditCopyFromComponent;
    view["walkTemplateRequest"] = 0;
    view.copySource = WalkCopyOption.COPY_SELECTED_WALK_LEADER;
    view.copySourceFromWalkLeaderMemberId = "leader-one";
    view.copyFrom = {walkTemplate: {} as ExtendedGroupEvent, walkTemplates: []};
    view["logger"] = {info: vi.fn(), error: vi.fn()} as unknown as typeof view["logger"];
    view["changeDetector"] = {markForCheck: vi.fn()} as unknown as ChangeDetectorRef;
    view["extendedGroupEventQueryService"] = {activeEvents: (events: ExtendedGroupEvent[]) => events} as typeof view["extendedGroupEventQueryService"];
    view.notify = {error: vi.fn()} as unknown as typeof view.notify;
    view["walkSummaryLabel"] = walk => walk.groupEvent.title;
    return view;
  }

  it("shows loading until completion and ignores an older search finishing last", async () => {
    const view = component();
    const pending: ((events: ExtendedGroupEvent[]) => void)[] = [];
    view["walksAndEventsService"] = {all: vi.fn(() => new Promise(resolve => pending.push(resolve)))} as unknown as typeof view["walksAndEventsService"];
    const first = view.populateWalkTemplates();
    expect(view.loadingWalkTemplates).toBe(true);
    const query = vi.mocked(view["walksAndEventsService"].all).mock.calls[0][0];
    expect(query.dataQueryOptions.select).toEqual({
      "groupEvent.title": 1,
      "groupEvent.start_date_time": 1,
      "groupEvent.distance_miles": 1,
      "groupEvent.distance_km": 1,
      "fields.contactDetails.displayName": 1,
      "fields.contactDetails.phone": 1,
      "events.date": 1,
      "events.eventType": 1
    });
    view.copySourceFromWalkLeaderMemberId = "leader-two";
    const second = view.populateWalkTemplates();
    const latest = {id: "latest", groupEvent: {title: "Hillside Park"}} as ExtendedGroupEvent;
    pending[1]([latest]);
    await second;
    expect(view.loadingWalkTemplates).toBe(false);
    expect(view.copyFrom.walkTemplates).toEqual([latest]);
    expect(view["changeDetector"].markForCheck).toHaveBeenCalled();
    pending[0]([{id: "older", groupEvent: {title: "Woodland walk"}} as ExtendedGroupEvent]);
    await first;
    expect(view.walkTemplateOptions.map(walk => walk.id)).toEqual(["latest"]);
  });

  it("loads walks before the leader lookup completes", async () => {
    const view = component();
    const pending: (() => void)[] = [];
    view["populateCopySourceFromWalkLeaderMemberId"] = vi.fn();
    view["subscriptions"] = [];
    view["display"] = {
      memberEvents: () => ({subscribe: () => ({unsubscribe: vi.fn()})}),
      refreshCachedData: vi.fn()
    } as unknown as typeof view["display"];
    view["populatePreviousWalkLeaders"] = vi.fn(() => new Promise<void>(resolve => pending.push(resolve)));
    view["walksAndEventsService"] = {all: vi.fn().mockResolvedValue([])} as unknown as typeof view["walksAndEventsService"];
    const initialising = view.ngOnInit();
    await vi.waitFor(() => expect(view.loadingWalkTemplates).toBe(false));
    expect(view["walksAndEventsService"].all).toHaveBeenCalledOnce();
    pending[0]();
    await initialising;
  });

  it("fetches the complete selected walk before copying its details", async () => {
    const view = component();
    const source = {
      id: "source-walk",
      groupEvent: {title: "Hillside Park", description: "Complete walk description"},
      fields: {contactDetails: {}, links: []}
    } as ExtendedGroupEvent;
    view.displayedWalk = {walk: {id: "target-walk", groupEvent: {}, fields: {contactDetails: {}}}} as DisplayedWalk;
    view["walksAndEventsService"] = {
      queryById: vi.fn().mockResolvedValue(source),
      urlFor: vi.fn().mockResolvedValue("hillside-park")
    } as unknown as typeof view["walksAndEventsService"];
    view["displayDate"] = {transform: () => "Sunday"} as unknown as typeof view["displayDate"];
    view["applyTimeOfDayToTargetDate"] = vi.fn();
    view["eventDefaultsService"] = {defaultContactDetails: () => ({})} as typeof view["eventDefaultsService"];
    view["walkEventService"] = {createEventIfRequired: vi.fn(), writeEventIfRequired: vi.fn()} as unknown as typeof view["walkEventService"];
    view.statusChange = {emit: vi.fn()} as unknown as typeof view.statusChange;
    view.tabRequest = {emit: vi.fn()} as unknown as typeof view.tabRequest;
    view.notify.success = vi.fn();
    await view.copyDetailsFromPreviousWalk({...source, groupEvent: {title: source.groupEvent.title}, ngSelectAttributes: {label: "Hillside Park"}} as typeof view.selectedWalkTemplateOption);
    expect(view["walksAndEventsService"].queryById).toHaveBeenCalledWith("source-walk");
    expect(view.displayedWalk.walk.groupEvent.description).toBe("Complete walk description");
    expect(view.displayedWalk.walk.id).toBe("target-walk");
    expect(source.id).toBe("source-walk");
    expect(view.notify.error).not.toHaveBeenCalled();
  });

  it("searches for either an OS Maps link or an attached GPX file", async () => {
    const view = component();
    view.copySource = WalkCopyOption.COPY_WITH_OS_MAPS_ROUTE_SELECTED;
    view["walksAndEventsService"] = {all: vi.fn().mockResolvedValue([])} as unknown as typeof view["walksAndEventsService"];
    await view.populateWalkTemplates();
    const query = vi.mocked(view["walksAndEventsService"].all).mock.calls[0][0];
    expect(query.dataQueryOptions.criteria).toEqual({
      $or: [
        {[EventField.LINKS]: {$elemMatch: {source: LinkSource.OS_MAPS, href: {$exists: true, $nin: [null, ""]}}}},
        {[EventField.GPX_FILE_AWS_FILE_NAME]: {$exists: true, $nin: [null, ""]}}
      ],
      [GroupEventField.TITLE]: {$exists: true},
      [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK
    });
  });

  it("clears loading and reports a failed search", async () => {
    const view = component();
    view["walksAndEventsService"] = {all: vi.fn().mockRejectedValue(new Error("Connection lost"))} as unknown as typeof view["walksAndEventsService"];
    await view.populateWalkTemplates();
    expect(view.loadingWalkTemplates).toBe(false);
    expect(view.notify.error).toHaveBeenCalled();
    expect(view.walkTemplateOptions).toEqual([]);
  });
});
