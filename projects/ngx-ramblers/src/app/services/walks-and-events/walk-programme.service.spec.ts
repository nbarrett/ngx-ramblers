import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { LoggerTestingModule } from "ngx-logger/testing";
import { WalkProgrammeService } from "./walk-programme.service";
import { LocalWalksAndEventsService } from "./local-walks-and-events.service";
import { ExtendedGroupEventQueryService } from "./extended-group-event-query.service";
import { DateUtilsService } from "../date-utils.service";
import { GroupEventField } from "../../models/walk.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";

describe("calendar event criteria", () => {
  it("combines list filters with the visible period and deleted-event exclusion", async () => {
    const allWithPagination = vi.fn().mockResolvedValue({response: []});
    const exclusion = {"events.eventType": {$ne: "deleted"}};
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        provideHttpClient(),
        {provide: LocalWalksAndEventsService, useValue: {allWithPagination}},
        {provide: ExtendedGroupEventQueryService, useValue: {excludingDeletedEventsCriteria: () => exclusion}},
        {provide: DateUtilsService, useValue: {isoDateTime: (value: number) => String(value)}}
      ]
    });
    const criteria = {$and: [{[GroupEventField.TITLE]: {$regex: "Hillside"}}, {[GroupEventField.DISTANCE_MILES]: {$lte: 5}}]};
    await TestBed.inject(WalkProgrammeService).eventsInRange({dateFrom: 100, dateTo: 200, walksOnly: true, criteria});
    expect(allWithPagination).toHaveBeenCalledWith(expect.objectContaining({criteria: {$and: [
      {
        [GroupEventField.START_DATE]: {$gte: "100", $lte: "200"},
        ...exclusion,
        [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK
      },
      criteria
    ]}}));
  });
});
