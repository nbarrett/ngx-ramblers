import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { RamblersWalksAndEventsService } from "./ramblers-walks-and-events.service";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { DateUtilsService } from "../date-utils.service";
import { ActivatedRoute } from "@angular/router";
import { WalkDisplayService } from "../../pages/walks/walk-display.service";
import { StringUtilsService } from "../string-utils.service";
import { MemberNamingService } from "../member/member-naming.service";
import { WalksReferenceService } from "../walks/walks-reference-data.service";
import { FeaturesService } from "../features.service";
import { UrlService } from "../url.service";
import { MailchimpConfigService } from "../mailchimp-config.service";
import { MailchimpLinkService } from "../mailchimp/mailchimp-link.service";
import { AscentValidationService } from "../walks/ascent-validation.service";
import { DistanceValidationService } from "../walks/distance-validation.service";
import { RiskAssessmentService } from "../walks/risk-assessment.service";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { ValueOrDefaultPipe } from "../../pipes/value-or-default.pipe";
import { SearchFilterPipe } from "../../pipes/search-filter.pipe";
import { CommitteeConfigService } from "../committee/commitee-config.service";
import { of } from "rxjs";
import { WalksConfigService } from "../system/walks-config.service";
import { LinkSource } from "../../models/walk.model";
import { MemberLoginService } from "../member/member-login.service";
import { WALK_PUBLISHED_AND_MATCHING, WALK_PUBLISHED_WITH_PROBLEMS } from "../../models/ramblers-walks-manager";

describe("RamblersWalksAndEventsService", () => {
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
          toDisplayedWalk: walk => ({walk})
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
              get: () => "some-value",
            },
          },
        },
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
          walksConfig: () => ({milesPerHour: 2.13, requireRiskAssessment: true, requireFinishTime: true, requireWalkLeaderDisplayName: true})
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

  it("should be created", () => {
    const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
    expect(service).toBeTruthy();
  });

  describe("toWalkExport", () => {
    const exportableWalkWithContactName = (contactName: string) => ({
      localWalk: {
        groupEvent: {
          title: "Coastal walk",
          start_date_time: "2026-07-04T10:00:00.000Z",
          end_date_time: "12:30",
          difficulty: "Leisurely",
          description: "A coastal walk",
          start_location: {postcode: "CT1 1AA"},
          shape: "Circular"
        },
        fields: {
          riskAssessment: [],
          publishing: {ramblers: {publish: true, contactName}}
        },
        events: []
      }
    });

    it("should return a validation message if the title is longer than 100 characters", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walk = {
        localWalk: {
          groupEvent: {
            title: "a".repeat(101)
          },
          fields: {
            riskAssessment: []
          }
        }
      };
      const walkExport = service.toWalkExport(walk as any);
      expect(walkExport.validationMessages).toContain("title must not exceed 100 characters");
    });

    it("should return a validation message if the Walks Manager Contact Name is first name plus surname initial", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(exportableWalkWithContactName("Jenny B") as any);
      expect(walkExport.validationMessages).toContain("Walk leader Walks Manager Contact Name (Jenny B) appears to be abbreviated. Enter the full first name and surname used in Walks Manager. This can be entered on the Walk Leader tab");
    });

    it("should return a validation message if the Walks Manager Contact Name is first initial plus surname", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(exportableWalkWithContactName("M Daniels") as any);
      expect(walkExport.validationMessages).toContain("Walk leader Walks Manager Contact Name (M Daniels) appears to be abbreviated. Enter the full first name and surname used in Walks Manager. This can be entered on the Walk Leader tab");
    });

    it("should allow a full Walks Manager Contact Name", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(exportableWalkWithContactName("Jenny Brown") as any);
      expect(walkExport.validationMessages.find(message => message.includes("appears to be abbreviated"))).toBeUndefined();
    });

    it("should keep the old numeric Ramblers contact Id validation", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(exportableWalkWithContactName("12345") as any);
      expect(walkExport.validationMessages).toContain("Walk leader has an old Ramblers contact Id (12345) setup on their member record. This needs to be updated to an Walks Manager Contact Name. This can be entered on the Walk Leader tab");
    });
  });

  describe("walkTitle", () => {
    it("replaces ampersands with the word 'and' to match what is uploaded to Ramblers", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.walkTitle({groupEvent: {title: "Hythe & Saltwood circular"}} as any))
        .toEqual("Hythe and Saltwood circular");
    });

    it("removes apostrophes to match what is uploaded to Ramblers", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.walkTitle({groupEvent: {title: "Dover to St Margaret's Bay on the White Cliffs"}} as any))
        .toEqual("Dover to St Margarets Bay on the White Cliffs");
    });
  });

  describe("updateWalksWithRamblersWalkData date change handling", () => {
    const ramblersUrl = "https://www.ramblers.org.uk/sunday-walk";
    const linkedLocalWalk = () => ({
      id: "local-mongo-id",
      groupEvent: {
        id: "ramblers-123",
        url: ramblersUrl,
        title: "Coastal walk",
        start_date_time: "2026-07-04T10:00:00.000Z",
        media: []
      },
      fields: {
        riskAssessment: [],
        links: [{source: LinkSource.RAMBLERS, href: ramblersUrl, title: "Coastal walk"}]
      },
      events: []
    });

    it("keeps a still-linked walk linked when its date no longer matches the Ramblers entry", async () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      (service as any).dryRun = true;
      const localWalk = linkedLocalWalk();
      const ramblersResponse = {id: "ramblers-123", url: ramblersUrl, title: "Coastal walk", startDate: "Sun 28-Jun-2026", media: []};
      await service.updateWalksWithRamblersWalkData([ramblersResponse] as any, [localWalk] as any);
      expect(localWalk.groupEvent.id).toEqual("ramblers-123");
      expect(localWalk.groupEvent.url).toEqual(ramblersUrl);
      expect(localWalk.fields.links.find(link => link.source === LinkSource.RAMBLERS)).toBeTruthy();
    });

    it("unlinks a walk whose Ramblers entry no longer exists", async () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      (service as any).dryRun = true;
      const localWalk = linkedLocalWalk();
      await service.updateWalksWithRamblersWalkData([], [localWalk] as any);
      expect(localWalk.groupEvent.id).toBeUndefined();
      expect(localWalk.groupEvent.url).toBeUndefined();
      expect(localWalk.fields.links.find(link => link.source === LinkSource.RAMBLERS)).toBeUndefined();
    });
  });

  describe("toWalkExport selection guarding and publish status messaging", () => {
    const publishedWalk = (groupEventOverrides: object = {}, ramblersWalkOverrides: object = {}) => ({
      localWalk: {
        groupEvent: {
          id: "ramblers-123",
          title: "Coastal walk",
          start_date_time: "2026-07-04T10:00:00.000Z",
          end_date_time: "12:30",
          difficulty: "Leisurely",
          description: "A coastal walk",
          distance_miles: 5,
          start_location: {postcode: "CT1 1AA"},
          shape: "Circular",
          ...groupEventOverrides
        },
        fields: {
          riskAssessment: [],
          publishing: {ramblers: {publish: true, contactName: "Jenny Brown"}}
        },
        events: []
      },
      ramblersWalk: {
        title: "Coastal walk",
        description: "A coastal walk",
        startDate: "Saturday, 4 July 2026",
        start_location: {postcode: "CT1 1AA"},
        ...ramblersWalkOverrides
      }
    });

    it("preselects a walk that requires republishing when it has no validation problems", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk({}, {title: "Coastal walk extended"}) as any);
      expect(walkExport.validationMessages).toEqual([]);
      expect(walkExport.publishStatus.publish).toBe(true);
      expect(walkExport.selected).toBe(true);
    });

    it("does not preselect a walk that requires republishing when it has validation problems", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk({distance_miles: null}, {title: "Coastal walk extended"}) as any);
      expect(walkExport.validationMessages).toContain("Distance is missing");
      expect(walkExport.publishStatus.publish).toBe(true);
      expect(walkExport.selected).toBe(false);
    });

    it("describes a matching published walk without overclaiming that all details are correct", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk() as any);
      expect(walkExport.publishStatus.messages).toEqual([WALK_PUBLISHED_AND_MATCHING]);
      expect(walkExport.selected).toBe(false);
    });

    it("acknowledges validation problems on a matching published walk", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk({distance_miles: null}) as any);
      expect(walkExport.validationMessages).toContain("Distance is missing");
      expect(walkExport.publishStatus.messages).toEqual([WALK_PUBLISHED_WITH_PROBLEMS]);
      expect(walkExport.selected).toBe(false);
    });
  });

  describe("toPublishStatus title comparison", () => {
    const publishedWalkWith = (websiteTitle: string, ramblersTitle: string) => ({
      localWalk: {
        groupEvent: {title: websiteTitle},
        fields: {riskAssessment: [], publishing: {ramblers: {publish: true}}},
        events: []
      },
      ramblersWalk: {title: ramblersTitle}
    });

    it("does not flag a title difference when the only difference is an ampersand cleaned on upload", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWith("Hythe & Saltwood circular", "Hythe and Saltwood circular") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Ramblers title is"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("does not flag a title difference when the only difference is an apostrophe cleaned on upload", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWith("Dover to St Margaret's Bay on the White Cliffs", "Dover to St Margarets Bay on the White Cliffs") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Ramblers title is"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("does not flag a title difference when Ramblers holds an ampersand that the website stores as the word and", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWith(
        "Iver to West Drayton via River Colne and Grand Union Canal",
        "Iver to West Drayton via River Colne & Grand Union Canal") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Ramblers title is"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("still flags a genuine title difference and marks the walk for republishing", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWith("Hythe and Saltwood extended circular", "Hythe and Saltwood circular") as any);
      expect(walkExport.publishStatus.messages.some(message => message.startsWith("Ramblers title is"))).toBe(true);
      expect(walkExport.publishStatus.publish).toBe(true);
    });

    it("flags a date difference and marks the walk for republishing", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport({
        localWalk: {
          groupEvent: {
            title: "Evening Walk: New Luckhurst Wood",
            start_date_time: "2026-07-16T18:30:00.000+01:00"
          },
          fields: {riskAssessment: [], publishing: {ramblers: {publish: true}}},
          events: []
        },
        ramblersWalk: {
          title: "Evening Walk: New Luckhurst Wood",
          startDate: "Thursday, 23 July 2026",
          startDateValue: 1784761200000
        }
      } as any);
      expect(walkExport.publishStatus.messages).toContain("Ramblers date is Thursday, 23 July 2026 but group website date is Thursday, 16 July 2026");
      expect(walkExport.publishStatus.publish).toBe(true);
    });
  });

  describe("toPublishStatus description comparison", () => {
    const publishedWalkWithDescriptions = (websiteDescription: string, ramblersDescription: string) => ({
      localWalk: {
        groupEvent: {title: "Coastal walk", description: websiteDescription},
        fields: {riskAssessment: [], publishing: {ramblers: {publish: true}}},
        events: []
      },
      ramblersWalk: {title: "Coastal walk", description: ramblersDescription}
    });

    it("does not flag a description difference when the website description contains HTML that is stripped on upload", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWithDescriptions(
        "<p>A lovely walk along the towpath.</p><p>Bring a packed lunch.</p>",
        "A lovely walk along the towpath. Bring a packed lunch.") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Description difference"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("does not flag a description difference when Ramblers holds HTML-entity apostrophes that the website cleans on upload", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWithDescriptions(
        "Passing Crow's Nest and St Mary's church, ideal for pensioners' outings",
        "Passing Crow&#039;s Nest and St Mary&#039;s church, ideal for pensioners&#039; outings") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Description difference"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("does not flag a description difference when Ramblers holds an ampersand that the website stores as the word and", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWithDescriptions(
        "A walk beside the River Colne and Grand Union Canal",
        "A walk beside the River Colne &amp; Grand Union Canal") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Description difference"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("flags a genuine description difference using the values that would be uploaded rather than raw HTML", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWithDescriptions(
        "<p>Meet at the car park.</p>",
        "Meet at the village hall.") as any);
      const message = walkExport.publishStatus.messages.find(item => item.includes("Description difference"));
      expect(message).toBeDefined();
      expect(message).not.toContain("&lt;p&gt;");
      expect(message).toContain("car");
      expect(walkExport.publishStatus.publish).toBe(true);
    });
  });
});
