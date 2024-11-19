import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { EventType, Walk } from "../../models/walk.model";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../../pipes/member-id-to-full-name.pipe";
import { StringUtilsService } from "../string-utils.service";

import { WalkEventService } from "./walk-event.service";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

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
      const service: WalkEventService = TestBed.inject(WalkEventService);
      const walk: Walk = {
        eventType: RamblersEventType.GROUP_WALK,
        walkDate: 12,
        start_location: {
          grid_reference_10: "123", postcode: "TN26 3HF", description: "this",
          latitude: 0,
          longitude: 0,
          grid_reference_6: "",
          grid_reference_8: "",
          w3w: ""
        },
        events: [{
          eventType: EventType.AWAITING_APPROVAL, date: 23, memberId: "12",
          data: {nearestTown: "that"}
        }]
      };
      expect(service.walkDataAuditFor(walk, EventType.AWAITING_APPROVAL, true).changedItems)
        .toEqual([
          {fieldName: "start_location", previousValue: undefined, currentValue: {
              grid_reference_10: "123", postcode: "TN26 3HF", description: "this",
              latitude: 0,
              longitude: 0,
              grid_reference_6: "",
              grid_reference_8: "",
              w3w: ""
            }},
          {fieldName: "walkDate", previousValue: undefined, currentValue: 12},
        ]);
    });
  });

  describe("latestEventWithStatusChangeIs", () => {
    it("should return a value if there is no existing event with status change", () => {
      const service: WalkEventService = TestBed.inject(WalkEventService);
      const walk: Walk = {
        eventType: RamblersEventType.GROUP_WALK,
        walkDate: 12,
        start_location: {
          grid_reference_10: "123", postcode: "TN26 3HF", description: "this",
          latitude: 0,
          longitude: 0,
          grid_reference_6: "",
          grid_reference_8: "",
          w3w: ""
        },
        events: [{
          eventType: EventType.WALK_DETAILS_COPIED, date: 23, memberId: "12",
          data: {nearestTown: "that"}
        }]
      };
      expect(service.latestEventWithStatusChangeIs(walk, EventType.AWAITING_APPROVAL))
        .toBe(false);
    });
  });
});
