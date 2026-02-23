import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { EventType } from "../../models/walk.model";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../../pipes/member-id-to-full-name.pipe";
import { StringUtilsService } from "../string-utils.service";

import { GroupEventService } from "../walks-and-events/group-event.service";
import { LocationDetails } from "../../models/ramblers-walks-manager";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { createExtendedGroupEvent } from "../../pages/walks/walk-display.service.spec";
import { DateUtilsService } from "../date-utils.service";
import { ChangedItem } from "../../models/changed-item.model";
import { pick } from "es-toolkit/compat";
import { AUDITED_FIELDS } from "../../models/walk-event.model";

describe("WalksEventService", () => {
  const MemberLoginService = {
    memberLoggedIn: () => true,
    loggedInMember: () => {
    },
    allowWalkAdminEdits: () => true
  };

  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, RouterTestingModule],
    providers: [{ provide: "MemberAuditService", useValue: {} },
        AuditDeltaChangedItemsPipePipe, StringUtilsService, MemberIdToFullNamePipe, FullNameWithAliasPipe, FullNamePipe,
        { provide: "MemberService", useValue: MemberLoginService }, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
}));

  describe("dataAuditDelta", () => {
    it("changedItems should correctly calculate difference", () => {
      const service: GroupEventService = TestBed.inject(GroupEventService);
      const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
      const oldStartLocation = {
        grid_reference_10: "123", postcode: "TN26 3HF", description: "this",
        latitude: 0,
        longitude: 0,
        grid_reference_6: "",
        grid_reference_8: "",
        w3w: ""
      };
      const oldWalk: ExtendedGroupEvent = createExtendedGroupEvent(dateUtilsService, 12, [], "any-walk-id", null);
      const data: ExtendedGroupEvent = pick(oldWalk,  AUDITED_FIELDS) as ExtendedGroupEvent;
      const events = [{
        eventType: EventType.AWAITING_APPROVAL, date: 23, memberId: "12",
        data
      }];
      const startLocation = {
        grid_reference_10: "123", postcode: "TN26 3HF", description: "this",
        latitude: 0,
        longitude: 0,
        grid_reference_6: "",
        grid_reference_8: "",
        w3w: ""
      };
      const walk: ExtendedGroupEvent = createExtendedGroupEvent(dateUtilsService, 12, {}, "any-walk-id", startLocation);
      walk.events = events;
      const actual: ChangedItem[] = service.walkDataAuditFor(walk, EventType.AWAITING_APPROVAL, true).changedItems;
      const expected: ChangedItem[] = [{
        fieldName: "groupEvent.start_location",
        previousValue: undefined,
        currentValue: {
          grid_reference_10: "123", postcode: "TN26 3HF", description: "this",
          latitude: 0,
          longitude: 0
        }
      }];
      expect(actual).toEqual(expected);
    });
  });

  describe("latestEventWithStatusChangeIs", () => {
    it("should return a value if there is no existing event with status change", () => {
      const service: GroupEventService = TestBed.inject(GroupEventService);
      const dateUtilsService: DateUtilsService = TestBed.inject(DateUtilsService);
      const events = [{
        eventType: EventType.WALK_DETAILS_COPIED, date: 23, memberId: "12",
        data: {nearestTown: "that"}
      }];
      const startLocation: LocationDetails = {
        grid_reference_10: "123", postcode: "TN26 3HF", description: "this",
        latitude: 0,
        longitude: 0,
        grid_reference_6: "",
        grid_reference_8: "",
        w3w: ""
      };
      const walk: ExtendedGroupEvent = createExtendedGroupEvent(dateUtilsService, 12, events, "any-walk-id", startLocation);
      expect(service.latestEventWithStatusChangeIs(walk, EventType.AWAITING_APPROVAL))
        .toBe(false);
    });
  });
});
