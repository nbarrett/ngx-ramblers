import { DateTime } from "luxon";
import { CdkDragDrop } from "@angular/cdk/drag-drop";
import { CalendarDay } from "../../../models/walk-programme.model";
import { WalkProgrammeCalendarComponent } from "./walk-programme-calendar";

describe("calendar rescheduling permissions", () => {
  it("keeps the embedded public calendar read-only even for administrators", () => {
    const context = {
      readOnly: true,
      display: {walkPopulationLocal: () => true},
      memberLoginService: {allowWalkAdminEdits: () => true},
      walksConfigService: {walksConfig: () => ({allowCalendarDragToReschedule: true})}
    };
    expect(WalkProgrammeCalendarComponent.prototype.dragEnabled.call(context as unknown as WalkProgrammeCalendarComponent)).toBe(false);
  });

  it("does not reschedule from a read-only calendar", async () => {
    const reschedule = vi.fn();
    const context = {dragEnabled: () => false, reschedule};
    const drop = {item: {data: {id: "hillside-walk"}}, container: {data: {value: 1}}, previousContainer: {}} as unknown as CdkDragDrop<CalendarDay>;
    await WalkProgrammeCalendarComponent.prototype.onDrop.call(context as unknown as WalkProgrammeCalendarComponent, drop);
    expect(reschedule).not.toHaveBeenCalled();
  });

  it("reschedules a walk only when calendar editing is enabled", async () => {
    const reschedule = vi.fn().mockResolvedValue(null);
    const context = {dragEnabled: () => true, reschedule};
    const entry = {id: "hillside-walk"};
    const drop = {item: {data: entry}, container: {data: {value: 1}}, previousContainer: {}} as unknown as CdkDragDrop<CalendarDay>;
    await WalkProgrammeCalendarComponent.prototype.onDrop.call(context as unknown as WalkProgrammeCalendarComponent, drop);
    expect(reschedule).toHaveBeenCalledWith(entry, 1);
  });
});

describe("calendar list filters", () => {
  it("passes active list criteria into the query for the visible period", async () => {
    const instance: any = Object.create(WalkProgrammeCalendarComponent.prototype);
    const start = DateTime.fromISO("2030-01-01", {zone: "Europe/London"});
    const end = start.endOf("month");
    const criteria = {"groupEvent.title": {$regex: "Hillside"}};
    const eventsInRange = vi.fn().mockResolvedValue([]);
    Object.assign(instance, {
      reloadRequestId: 0,
      criteria,
      constrainFrom: null,
      constrainTo: null,
      displayedWalks: null,
      walksOnly: false,
      rangeStart: () => start,
      rangeEnd: () => end,
      walkProgrammeService: {eventsInRange},
      display: {walkPopulationWalksManager: () => false},
      committeeFilesInRange: vi.fn().mockResolvedValue([]),
      buildDays: vi.fn(),
      emitMonthLoaded: vi.fn(),
      scrollPosition: {restore: vi.fn()}
    });
    await instance.reload();
    expect(eventsInRange).toHaveBeenCalledWith({dateFrom: start.valueOf(), dateTo: end.valueOf(), walksOnly: false, criteria});
  });
});
