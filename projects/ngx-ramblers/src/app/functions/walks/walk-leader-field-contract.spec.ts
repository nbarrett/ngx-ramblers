import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { of } from "rxjs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  remoteWalksManagerContactNameForCompare,
  websiteWalkLeaderDisplayName,
  walksManagerContactNamesForCsv,
  walksManagerWalkLeaderNameFromGroupEvent
} from "./walk-leader-fields";
import { walkLeaderNamesMatch } from "./joint-walk-leaders";
import { RamblersWalksAndEventsService } from "../../services/walks-and-events/ramblers-walks-and-events.service";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { DateUtilsService } from "../../services/date-utils.service";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { MemberNamingService } from "../../services/member/member-naming.service";
import { WalksReferenceService } from "../../services/walks/walks-reference-data.service";
import { FeaturesService } from "../../services/features.service";
import { UrlService } from "../../services/url.service";
import { MailchimpConfigService } from "../../services/mailchimp-config.service";
import { MailchimpLinkService } from "../../services/mailchimp/mailchimp-link.service";
import { AscentValidationService } from "../../services/walks/ascent-validation.service";
import { DistanceValidationService } from "../../services/walks/distance-validation.service";
import { RiskAssessmentService } from "../../services/walks/risk-assessment.service";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { ValueOrDefaultPipe } from "../../pipes/value-or-default.pipe";
import { SearchFilterPipe } from "../../pipes/search-filter.pipe";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { WalksConfigService } from "../../services/system/walks-config.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { ActivatedRoute } from "@angular/router";
import { EventField, GroupEventField } from "../../models/walk.model";
import { WalkEditField, WalkUploadColumnHeading } from "../../models/ramblers-walks-manager";

describe("CONTRACT: walk leader fields — what each field is for (no ambiguity)", () => {

  const walkWithBothNames = {
    id: "walk-1",
    fields: {
      contactDetails: {
        displayName: "Kerry Example",
        memberId: "member-kerry",
        email: "kerry@example.org",
        phone: "07000 000000",
        contactId: null
      },
      publishing: {
        ramblers: {publish: true, contactName: "Kerry O'Grady"},
        meetup: {publish: false, contactName: null}
      },
      riskAssessment: [],
      links: []
    },
    groupEvent: {
      id: "ramblers-walk-1",
      title: "Coastal walk",
      start_date_time: "2026-08-09T10:00:00.000Z",
      end_date_time: "15:15",
      difficulty: "Moderate",
      description: "A coastal walk",
      distance_miles: 13,
      start_location: {postcode: "CT1 1AA"},
      shape: "Circular",
      walk_leader: {name: "Kerry O'Grady", id: "volunteer-kerry"}
    },
    events: []
  } as any;

  describe("fields.contactDetails.displayName — website display name ONLY", () => {
    it("path is fields.contactDetails.displayName (EventField.CONTACT_DETAILS_DISPLAY_NAME)", () => {
      expect(EventField.CONTACT_DETAILS_DISPLAY_NAME).toBe("fields.contactDetails.displayName");
    });

    it("is the short name shown on this website (for example Kerry Example or Nick B)", () => {
      expect(websiteWalkLeaderDisplayName(walkWithBothNames)).toBe("Kerry Example");
    });

    it("is never used as the Walks Manager CSV Walk leaders value", () => {
      expect(walksManagerContactNamesForCsv(walkWithBothNames)).not.toBe(websiteWalkLeaderDisplayName(walkWithBothNames));
      expect(walksManagerContactNamesForCsv(walkWithBothNames)).not.toBe("Kerry Example");
    });

    it("is the wrong local field for export diffs — export must use Walks Manager contact name instead", () => {
      const websiteName = websiteWalkLeaderDisplayName(walkWithBothNames);
      const contactNameForCsv = walksManagerContactNamesForCsv(walkWithBothNames);
      const walksManagerListed = walksManagerWalkLeaderNameFromGroupEvent(walkWithBothNames.groupEvent);
      expect(websiteName).toBe("Kerry Example");
      expect(contactNameForCsv).toBe("Kerry O'Grady");
      expect(walksManagerListed).toBe("Kerry O'Grady");
      expect(walkLeaderNamesMatch(contactNameForCsv, walksManagerListed)).toBe(true);
      expect(contactNameForCsv).not.toBe(websiteName);
    });
  });

  describe("fields.publishing.ramblers.contactName — Walks Manager contact name for CSV and matching", () => {
    it("path is fields.publishing.ramblers.contactName (EventField.PUBLISHING_RAMBLERS_CONTACT_NAME)", () => {
      expect(EventField.PUBLISHING_RAMBLERS_CONTACT_NAME).toBe("fields.publishing.ramblers.contactName");
    });

    it("is the full name used in Walks Manager and in the CSV Walk leaders column", () => {
      expect(walksManagerContactNamesForCsv(walkWithBothNames)).toBe("Kerry O'Grady");
    });

    it("is the local side of export walk-leader comparison (never displayName)", () => {
      const localForExport = walksManagerContactNamesForCsv(walkWithBothNames);
      const remoteFromWalksManager = walksManagerWalkLeaderNameFromGroupEvent(walkWithBothNames.groupEvent);
      expect(localForExport).toBe("Kerry O'Grady");
      expect(remoteFromWalksManager).toBe("Kerry O'Grady");
      expect(walkLeaderNamesMatch(localForExport, remoteFromWalksManager)).toBe(true);
    });

    it("does not fall back to website display name when contact name is missing", () => {
      const walk = {
        fields: {
          contactDetails: {displayName: "Nick B"},
          publishing: {ramblers: {publish: true, contactName: null}}
        }
      } as any;
      expect(websiteWalkLeaderDisplayName(walk)).toBe("Nick B");
      expect(walksManagerContactNamesForCsv(walk)).toBe("");
    });
  });

  describe("groupEvent.walk_leader.name — leader name listed by the Walks Manager events API", () => {
    it("path is groupEvent.walk_leader.name (GroupEventField.WALK_LEADER_NAME)", () => {
      expect(GroupEventField.WALK_LEADER_NAME).toBe("groupEvent.walk_leader.name");
    });

    it("is the remote side of export walk-leader comparison when Walks Manager returns a name", () => {
      expect(walksManagerWalkLeaderNameFromGroupEvent(walkWithBothNames.groupEvent)).toBe("Kerry O'Grady");
    });

    it("when Walks Manager returns no name (for example contact prefs), blend listed name with prior history contact name", () => {
      const undisclosed = {walk_leader: {id: "volunteer-1", name: ""}} as any;
      expect(walksManagerWalkLeaderNameFromGroupEvent(undisclosed)).toBe("");
      expect(remoteWalksManagerContactNameForCompare("", "Deborah Kellond")).toBe("Deborah Kellond");
      expect(remoteWalksManagerContactNameForCompare("Deborah Kellond", "Nick Barrett")).toBe("Deborah Kellond");
      expect(remoteWalksManagerContactNameForCompare("", "")).toBe("");
    });
  });

  describe("the two local names must never be treated as interchangeable", () => {
    it("website display name and Walks Manager contact name can differ on the same walk and that is normal", () => {
      expect(websiteWalkLeaderDisplayName(walkWithBothNames)).toBe("Kerry Example");
      expect(walksManagerContactNamesForCsv(walkWithBothNames)).toBe("Kerry O'Grady");
      expect(websiteWalkLeaderDisplayName(walkWithBothNames))
        .not.toEqual(walksManagerContactNamesForCsv(walkWithBothNames));
    });

    it("export matching uses contact name vs Walks Manager listed name via the dedicated accessors", () => {
      const display = websiteWalkLeaderDisplayName(walkWithBothNames);
      const contact = walksManagerContactNamesForCsv(walkWithBothNames);
      const listed = walksManagerWalkLeaderNameFromGroupEvent(walkWithBothNames.groupEvent);
      expect(contact).toBe("Kerry O'Grady");
      expect(listed).toBe("Kerry O'Grady");
      expect(display).toBe("Kerry Example");
      expect(walkLeaderNamesMatch(contact, listed)).toBe(true);
      expect(contact).not.toBe(display);
    });
  });

  describe("RamblersWalksAndEventsService — CSV and export use contact name only", () => {
    beforeEach(() => TestBed.configureTestingModule({
      imports: [LoggerTestingModule, HttpClientTestingModule],
      providers: [
        RamblersWalksAndEventsService,
        DisplayDatePipe,
        DateUtilsService,
        {
          provide: WalkDisplayService,
          useValue: {
            gridReferenceFrom: () => null,
            toDisplayedWalk: walk => ({walk}),
            walkPopulationLocal: () => true,
            walkPublicLink: () => "https://example.com/walks/test-walk"
          }
        },
        StringUtilsService,
        MemberNamingService,
        WalksReferenceService,
        FeaturesService,
        UrlService,
        MailchimpConfigService,
        MailchimpLinkService,
        AscentValidationService,
        DistanceValidationService,
        RiskAssessmentService,
        AuditDeltaChangedItemsPipePipe,
        ValueOrDefaultPipe,
        SearchFilterPipe,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => "some-value"
              }
            }
          }
        },
        {
          provide: CommitteeConfigService,
          useValue: {
            committeeReferenceDataEvents: () => of({
              contactUsFieldForBuiltInRole: () => "some-full-name"
            })
          }
        },
        {
          provide: WalksConfigService,
          useValue: {
            events: () => of({}),
            walksConfig: () => ({
              milesPerHour: 2.13,
              requireRiskAssessment: true,
              requireFinishTime: true,
              requireWalkLeaderDisplayName: true
            }),
            riskAssessmentSections: () => []
          }
        },
        {
          provide: MemberLoginService,
          useValue: {
            allowWalkAdminEdits: () => true
          }
        }
      ]
    }));

    it("walkLeader() is an alias for walksManagerContactNamesForCsv — never display name", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.walkLeader(walkWithBothNames)).toBe("Kerry O'Grady");
      expect(service.walksManagerContactNamesForCsv(walkWithBothNames)).toBe("Kerry O'Grady");
      expect(service.walkLeader(walkWithBothNames)).toBe(service.walksManagerContactNamesForCsv(walkWithBothNames));
      expect(service.walkLeader(walkWithBothNames)).not.toBe("Kerry Example");
    });

    it("CSV Walk leaders column is filled from Walks Manager contact name only", async () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      const row = await service.walkToWalkUploadRow(walkWithBothNames);
      expect(row[WalkUploadColumnHeading.WALK_LEADERS]).toBe("Kerry O'Grady");
      expect(row[WalkUploadColumnHeading.WALK_LEADERS]).not.toBe("Kerry Example");
      expect(row[WalkUploadColumnHeading.WALK_LEADERS]).toBe(walksManagerContactNamesForCsv(walkWithBothNames));
    });

    it("export field change for walk leaders compares contact name to Walks Manager listed name", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      const changed = service.toWalkExport({
        localWalk: {
          ...walkWithBothNames,
          fields: {
            ...walkWithBothNames.fields,
            publishing: {
              ramblers: {publish: true, contactName: "Nick Barrett"},
              meetup: {publish: false, contactName: null}
            }
          }
        },
        ramblersWalk: {
          title: walkWithBothNames.groupEvent.title,
          description: walkWithBothNames.groupEvent.description,
          startDate: "Sunday, 9 August 2026",
          start_location: walkWithBothNames.groupEvent.start_location,
          groupEvent: {
            ...walkWithBothNames.groupEvent,
            walk_leader: {name: "Deborah Kellond"}
          }
        }
      } as any);

      expect(changed.fieldChanges.map(change => change.field)).toContain(WalkEditField.WALK_LEADERS);
      const leaderChange = changed.fieldChanges.find(change => change.field === WalkEditField.WALK_LEADERS);
      expect(leaderChange.existingValue).toBe("Deborah Kellond");
      expect(leaderChange.value).toBe("Nick Barrett");
      expect(leaderChange.value).not.toBe("Nick B");
      expect(leaderChange.existingValue).not.toBe(websiteWalkLeaderDisplayName(walkWithBothNames));
    });

    it("when Walks Manager returns no leader name and history has the same contact name, export does not invent a walk-leader field change", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      const result = service.toWalkExport({
        localWalk: walkWithBothNames,
        ramblersWalk: {
          title: walkWithBothNames.groupEvent.title,
          description: walkWithBothNames.groupEvent.description,
          startDate: "Sunday, 9 August 2026",
          start_location: walkWithBothNames.groupEvent.start_location,
          groupEvent: {
            ...walkWithBothNames.groupEvent,
            walk_leader: {id: "volunteer-1", name: ""}
          }
        }
      } as any);

      expect(result.fieldChanges.map(change => change.field)).not.toContain(WalkEditField.WALK_LEADERS);
    });

    it("when Walks Manager redacts the leader name, export still detects a contact-name change from walk history (for example Deborah Kellond to Nick Barrett)", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      const walkWithLeaderChange = {
        ...walkWithBothNames,
        fields: {
          ...walkWithBothNames.fields,
          contactDetails: {
            ...walkWithBothNames.fields.contactDetails,
            displayName: "Nick B",
            memberId: "member-nick"
          },
          publishing: {
            ramblers: {publish: true, contactName: "Nick Barrett"},
            meetup: {publish: false, contactName: null}
          }
        },
        groupEvent: {
          ...walkWithBothNames.groupEvent,
          walk_leader: {id: "volunteer-deborah", name: "Deborah K1"}
        },
        events: [
          {
            eventType: "approved",
            date: 1,
            data: {
              fields: {
                publishing: {ramblers: {publish: true, contactName: "Deborah Kellond"}},
                contactDetails: {displayName: "Deborah K1"}
              },
              groupEvent: {walk_leader: {name: "Deborah K1"}}
            }
          },
          {
            eventType: "walkDetailsUpdated",
            date: 2,
            data: {
              fields: {
                publishing: {ramblers: {publish: true, contactName: "Nick Barrett"}},
                contactDetails: {displayName: "Nick B"}
              },
              groupEvent: {walk_leader: {name: "Deborah K1"}}
            }
          }
        ]
      };
      const result = service.toWalkExport({
        localWalk: walkWithLeaderChange,
        ramblersWalk: {
          title: walkWithLeaderChange.groupEvent.title,
          description: walkWithLeaderChange.groupEvent.description,
          startDate: "Sunday, 9 August 2026",
          start_location: walkWithLeaderChange.groupEvent.start_location,
          groupEvent: {
            ...walkWithLeaderChange.groupEvent,
            walk_leader: {name: "", telephone: "", has_email: true, is_overridden: false}
          }
        }
      } as any);

      expect(result.fieldChanges.map(change => change.field)).toContain(WalkEditField.WALK_LEADERS);
      const leaderChange = result.fieldChanges.find(change => change.field === WalkEditField.WALK_LEADERS);
      expect(leaderChange.existingValue).toBe("Deborah Kellond");
      expect(leaderChange.value).toBe("Nick Barrett");
      expect(result.editInPlace).toBe(true);
      expect(result.publishStatus.messages.some(message =>
        message.includes("walk leaders (Deborah Kellond → Nick Barrett)")
      )).toBe(true);
    });
  });
});
