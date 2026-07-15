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
import { WALK_PUBLISHED_AND_MATCHING, WALK_PUBLISHED_WITH_PROBLEMS, WalkEditField } from "../../models/ramblers-walks-manager";
import { vi } from "vitest";

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
          toDisplayedWalk: walk => ({walk}),
          walkPopulationLocal: () => false,
          walkPublicLink: walk => `https://example.com/walks/${walk?.groupEvent?.url || "test-walk"}`
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

  describe("walkImageUploads", () => {
    const selectedWalk = {
      selected: true,
      displayedWalk: {
        walk: {
          groupEvent: {
            title: "Woodland walk",
            start_date_time: "2026-07-15T18:30:00.000Z",
            status: "confirmed",
            media: [{
              alt: "A woodland path",
              title: "Woodland",
              styles: [{style: "medium", url: "https://example.com/images/path.jpeg"}]
            }]
          },
          fields: {publishing: {ramblers: {publish: true}}}
        }
      }
    };

    it("includes ordered media for local walk population", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      const display = TestBed.inject(WalkDisplayService);
      vi.spyOn(display, "walkPopulationLocal").mockReturnValue(true);

      expect(service.walkImageUploads([selectedWalk] as any)).toEqual([{
        date: "15/07/2026",
        fieldChanges: [],
        imagesChanged: false,
        images: [{
          alternativeText: "A woodland path",
          fileName: "path.jpeg",
          sourceUrl: "https://example.com/images/path.jpeg"
        }],
        title: "Woodland walk",
        walkId: null
      }]);
    });

    it("excludes media for Walks Manager population", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.walkImageUploads([selectedWalk] as any)).toEqual([]);
    });
  });

  describe("ramblersWalksReconciliation", () => {
    const walkExport = (title: string, publish: boolean, ramblersUrl?: string) => ({
      selected: false,
      ramblersUrl,
      displayedWalk: {
        walk: {
          groupEvent: {title, id: ramblersUrl ? `${title}-id` : null, start_date_time: "2026-07-15T18:30:00.000Z"},
          fields: {publishing: {ramblers: {publish}}}
        }
      }
    });

    it("reports local walks, walks found on ramblers and those missing", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      const walkExports = [
        walkExport("Biddenden", true, "https://walks-manager.ramblers.org.uk/walk/1"),
        walkExport("Chilham", true, "https://walks-manager.ramblers.org.uk/walk/2"),
        walkExport("Farnborough", true, "https://walks-manager.ramblers.org.uk/walk/3"),
        walkExport("Wye", true)
      ];
      expect(service.ramblersWalksReconciliation(walkExports as any)).toEqual({
        localWalks: 4,
        walksOnRamblers: 3,
        missingFromRamblers: 1
      });
    });

    it("excludes walks that are not configured for ramblers publishing", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      const walkExports = [
        walkExport("Biddenden", true, "https://walks-manager.ramblers.org.uk/walk/1"),
        walkExport("Local only", false)
      ];
      expect(service.ramblersWalksReconciliation(walkExports as any)).toEqual({
        localWalks: 1,
        walksOnRamblers: 1,
        missingFromRamblers: 0
      });
    });

    it("reports every walk as missing when none exist on ramblers", () => {
      const service = TestBed.inject(RamblersWalksAndEventsService);
      const walkExports = [walkExport("Biddenden", true), walkExport("Chilham", true)];
      expect(service.ramblersWalksReconciliation(walkExports as any)).toEqual({
        localWalks: 2,
        walksOnRamblers: 0,
        missingFromRamblers: 2
      });
    });
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

    it("should allow joint leaders when every name is full", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(exportableWalkWithContactName("Tom Gamble; Sarah Mitchell") as any);
      expect(walkExport.validationMessages.find(message => message.includes("appears to be abbreviated"))).toBeUndefined();
    });

    it("should flag joint leaders whose first-listed name is abbreviated", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(exportableWalkWithContactName("Tom G; Sarah Mitchell") as any);
      expect(walkExport.validationMessages).toContain("Walk leader Walks Manager Contact Name (Tom G) appears to be abbreviated. Enter the full first name and surname used in Walks Manager. This can be entered on the Walk Leader tab");
    });

    it("should flag joint leaders whose second-listed name is abbreviated", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(exportableWalkWithContactName("Tom Gamble; Sarah M") as any);
      expect(walkExport.validationMessages).toContain("Walk leader Walks Manager Contact Name (Sarah M) appears to be abbreviated. Enter the full first name and surname used in Walks Manager. This can be entered on the Walk Leader tab");
    });

    it("should flag a website link containing accented characters", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walk = exportableWalkWithContactName("Jenny Brown");
      (walk.localWalk.groupEvent as any).url = "community-café-walk";
      const walkExport = service.toWalkExport(walk as any);
      expect(walkExport.validationMessages.find(message => message.includes("contains accented or special characters"))).toBeDefined();
    });

    it("should not flag a plain ascii website link", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(exportableWalkWithContactName("Jenny Brown") as any);
      expect(walkExport.validationMessages.find(message => message.includes("contains accented or special characters"))).toBeUndefined();
    });
  });

  describe("walkLeader", () => {
    it("returns all joint walk leaders semicolon-separated, matching the Walks Manager CSV template format", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.walkLeader({fields: {publishing: {ramblers: {contactName: "Tom Gamble; Sarah Mitchell"}}}} as any)).toBe("Tom Gamble; Sarah Mitchell");
    });

    it("normalises separator spacing in joint walk leaders", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.walkLeader({fields: {publishing: {ramblers: {contactName: "Tom Gamble;Sarah Mitchell"}}}} as any)).toBe("Tom Gamble; Sarah Mitchell");
    });

    it("returns a single leader unchanged", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.walkLeader({fields: {publishing: {ramblers: {contactName: "Tom Gamble"}}}} as any)).toBe("Tom Gamble");
    });

    it("returns empty string when no contact name is present", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.walkLeader({} as any)).toBe("");
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
    const localSlug = "coastal-walk";
    const linkedLocalWalk = () => ({
      id: "local-mongo-id",
      groupEvent: {
        id: "ramblers-123",
        url: localSlug,
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

    const unlinkedLocalWalk = () => ({
      id: "local-mongo-id",
      groupEvent: {
        title: "Coastal walk",
        url: localSlug,
        start_date_time: "2026-07-04T10:00:00.000Z",
        media: []
      },
      fields: {riskAssessment: [], links: []},
      events: []
    });

    it("keeps a still-linked walk linked when its date no longer matches the Ramblers entry", async () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      (service as any).dryRun = true;
      const localWalk = linkedLocalWalk();
      const ramblersResponse = {id: "ramblers-123", url: ramblersUrl, title: "Coastal walk", startDate: "Sun 28-Jun-2026", media: []};
      await service.updateWalksWithRamblersWalkData([ramblersResponse] as any, [localWalk] as any);
      expect(localWalk.groupEvent.id).toEqual("ramblers-123");
      expect(localWalk.groupEvent.url).toEqual(localSlug);
      expect(localWalk.fields.links.find(link => link.source === LinkSource.RAMBLERS)).toBeTruthy();
    });

    it("records the Ramblers url as a link without overwriting the local slug", async () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      (service as any).dryRun = true;
      const localWalk = unlinkedLocalWalk();
      const ramblersResponse = {id: "ramblers-123", url: ramblersUrl, title: "Coastal walk", startDate: "Saturday, 4 July 2026", media: []};
      await service.updateWalksWithRamblersWalkData([ramblersResponse] as any, [localWalk] as any);
      expect(localWalk.groupEvent.url).toEqual(localSlug);
      expect((localWalk.groupEvent as any).id).toEqual("ramblers-123");
      expect(localWalk.fields.links.find(link => link.source === LinkSource.RAMBLERS).href).toEqual(ramblersUrl);
    });

    it("finds the Ramblers url of a linked walk from its link rather than its slug", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      expect(service.ramblersUrlFor(linkedLocalWalk() as any)).toEqual(ramblersUrl);
    });

    it("treats a walk with no Ramblers link as unlinked, leaving the next export to re-establish it", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkWithoutLink = {groupEvent: {url: ramblersUrl}, fields: {links: []}};
      expect(service.ramblersUrlFor(walkWithoutLink as any)).toEqual("");
    });

    it("unlinks a walk whose Ramblers entry no longer exists", async () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      (service as any).dryRun = true;
      const localWalk = linkedLocalWalk();
      await service.updateWalksWithRamblersWalkData([], [localWalk] as any);
      expect(localWalk.groupEvent.id).toBeUndefined();
      expect(localWalk.groupEvent.url).toEqual(localSlug);
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
        ...ramblersWalkOverrides,
        groupEvent: {
          title: "Coastal walk",
          start_date_time: "2026-07-04T10:00:00.000Z",
          end_date_time: "12:30",
          difficulty: "Leisurely",
          description: "A coastal walk",
          distance_miles: 5,
          start_location: {postcode: "CT1 1AA"},
          shape: "Circular",
          ...ramblersWalkOverrides
        }
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

    it("preselects an image-only mismatch without scheduling CSV replacement", async () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      vi.spyOn(TestBed.inject(WalkDisplayService), "walkPopulationLocal").mockReturnValue(true);
      const localMedia = [{alt: "Castle view", title: "Castle", styles: [{style: "medium", url: "https://example.com/castle.jpeg"}]}];
      const walkExport = service.toWalkExport(publishedWalk({media: localMedia}, {media: [], walksManagerUrl: "https://walks-manager.ramblers.org.uk/walks-manager/walk/basic-information/walk-123"}) as any);

      expect(walkExport.selected).toBe(true);
      expect(walkExport.imageUploadOnly).toBe(true);
      expect(walkExport.publishStatus.messages).toContain("Ramblers images differ from the 1 image on the group website");
      expect(await service.walkUploadRows([walkExport])).toEqual([]);
      expect(service.walkUploadList([walkExport])).toEqual([]);
      expect(service.walkDeletionList([walkExport])).toEqual([]);
      expect(service.walkImageUploads([walkExport])[0].walkId).toEqual("https://walks-manager.ramblers.org.uk/walks-manager/walk/basic-information/walk-123");
    });

    it("preselects removal when Ramblers has images but the local walk has none", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      vi.spyOn(TestBed.inject(WalkDisplayService), "walkPopulationLocal").mockReturnValue(true);
      const ramblersMedia = [{alt: "Old image", title: "Old", styles: [{style: "medium", url: "https://example.com/old.jpeg"}]}];
      const walkExport = service.toWalkExport(publishedWalk({media: []}, {media: ramblersMedia, walksManagerUrl: "https://walks-manager.ramblers.org.uk/walks-manager/walk/basic-information/walk-123"}) as any);

      expect(walkExport.selected).toBe(true);
      expect(walkExport.imageUploadOnly).toBe(true);
      expect(service.walkImageUploads([walkExport])).toEqual([{
        date: "04/07/2026",
        fieldChanges: [],
        imagesChanged: true,
        images: [],
        title: "Coastal walk",
        walkId: "https://walks-manager.ramblers.org.uk/walks-manager/walk/basic-information/walk-123"
      }]);
    });

    it("does not select a walk when ordered image alternative text matches", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      vi.spyOn(TestBed.inject(WalkDisplayService), "walkPopulationLocal").mockReturnValue(true);
      const media = [{alt: "Castle view", title: "Castle", styles: [{style: "medium", url: "https://example.com/castle.jpeg"}]}];
      const walkExport = service.toWalkExport(publishedWalk({media}, {media}) as any);

      expect(walkExport.selected).toBe(false);
      expect(walkExport.imageUploadOnly).toBe(false);
      expect(walkExport.publishStatus.messages).toEqual([WALK_PUBLISHED_AND_MATCHING]);
    });

    it("edits the walk in place rather than replacing it when details and images both differ", async () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      vi.spyOn(TestBed.inject(WalkDisplayService), "walkPopulationLocal").mockReturnValue(true);
      const localMedia = [{alt: "Castle view", title: "Castle", styles: [{style: "medium", url: "https://example.com/castle.jpeg"}]}];
      const walkExport = service.toWalkExport(publishedWalk({media: localMedia}, {title: "Different title", media: []}) as any);

      expect(walkExport.selected).toBe(true);
      expect(walkExport.editInPlace).toBe(true);
      expect(walkExport.fieldChanges.map(change => change.field)).toEqual([WalkEditField.TITLE]);
      expect(await service.walkUploadRows([walkExport])).toEqual([]);
      expect(service.walkDeletionList([walkExport])).toEqual([]);
      expect(service.walkUploadList([walkExport])).toEqual([]);
    });

    it("ignores the walk leader, which Ramblers abbreviates to an initial and cannot be compared", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk({}, {walk_leader: {name: "Jenny B."}}) as any);

      expect(walkExport.locationChanged).toBe(false);
      expect(walkExport.editInPlace).toBe(false);
      expect(walkExport.publishStatus.messages).toEqual([WALK_PUBLISHED_AND_MATCHING]);
    });

    it("ignores a website link that differs only by the site it was generated from", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const display = TestBed.inject(WalkDisplayService);
      vi.spyOn(display, "walkPublicLink").mockReturnValue("http://localhost:4200/walks/coastal-walk");
      const walkExport = service.toWalkExport(publishedWalk({}, {external_url: "https://www.ekwg.co.uk/walks/coastal-walk"}) as any);

      expect(walkExport.fieldChanges).toEqual([]);
      expect(walkExport.editInPlace).toBe(false);
    });

    it("reports a website link that points at a different walk", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const display = TestBed.inject(WalkDisplayService);
      vi.spyOn(display, "walkPublicLink").mockReturnValue("https://www.ekwg.co.uk/walks/coastal-walk-revised");
      const walkExport = service.toWalkExport(publishedWalk({}, {external_url: "https://www.ekwg.co.uk/walks/coastal-walk"}) as any);

      expect(walkExport.fieldChanges.map(change => change.field)).toEqual([WalkEditField.WEBSITE_LINK]);
    });

    it("tolerates the rounding Ramblers applies to distance and ascent", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk({distance_miles: 9.5, ascent_feet: 407}, {distance_miles: 9.5, distance_km: 15.3, ascent_feet: 407, ascent_metres: 124}) as any);

      expect(walkExport.fieldChanges).toEqual([]);
      expect(walkExport.editInPlace).toBe(false);
    });

    it("ignores the lower case walk shape that Ramblers returns", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk({shape: "Circular"}, {shape: "circular"}) as any);

      expect(walkExport.fieldChanges).toEqual([]);
    });

    it("ignores a finish location that Ramblers does not report", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk({end_location: {postcode: "CT3 3CC"}}, {end_location: null}) as any);

      expect(walkExport.locationChanged).toBe(false);
    });

    it("replaces the walk through CSV when its start postcode has changed, because the form cannot geocode it", async () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      vi.spyOn(TestBed.inject(WalkDisplayService), "walkPopulationLocal").mockReturnValue(true);
      const walkExport = service.toWalkExport(publishedWalk({start_location: {postcode: "CT2 2BB"}}) as any);

      expect(walkExport.selected).toBe(true);
      expect(walkExport.locationChanged).toBe(true);
      expect(walkExport.editInPlace).toBe(false);
      expect((await service.walkUploadRows([walkExport])).length).toBe(1);
    });

    it("edits a walk in place when only its distance has changed", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalk({distance_miles: 7}) as any);

      expect(walkExport.editInPlace).toBe(true);
      expect(walkExport.fieldChanges.map(change => change.field)).toContain(WalkEditField.DISTANCE_MILES);
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
      expect(walkExport.publishStatus.messages.find(message => message.includes("Title difference:"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("does not flag a title difference when the only difference is an apostrophe cleaned on upload", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWith("Dover to St Margaret's Bay on the White Cliffs", "Dover to St Margarets Bay on the White Cliffs") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Title difference:"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("does not flag a title difference when Ramblers holds an ampersand that the website stores as the word and", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWith(
        "Iver to West Drayton via River Colne and Grand Union Canal",
        "Iver to West Drayton via River Colne & Grand Union Canal") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Title difference:"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("still flags a genuine title difference and marks the walk for republishing", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWith("Hythe and Saltwood extended circular", "Hythe and Saltwood circular") as any);
      expect(walkExport.publishStatus.messages.some(message => message.startsWith("Title difference:"))).toBe(true);
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

    it("does not flag a description difference when Ramblers holds a double-encoded ampersand", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWithDescriptions(
        "Turn off the A4155 at Mill End, signposted Hambleden, Skirmett and Fingest",
        "Turn off the A4155 at Mill End, signposted Hambleden, Skirmett &amp;amp; Fingest") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Description difference"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("does not flag a description difference when the website holds an en-dash that Walks Manager downgraded to a hyphen", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWithDescriptions(
        "Park in Mapledurham Playing Fields free car park, off Upper Woodcote Road. - nearest post code RG4 7LB",
        "Park in Mapledurham Playing Fields free car park, off Upper Woodcote Road. – nearest post code RG4 7LB") as any);
      expect(walkExport.publishStatus.messages.find(message => message.includes("Description difference"))).toBeUndefined();
      expect(walkExport.publishStatus.publish).toBe(false);
    });

    it("does not flag a description difference when the website holds an em-dash that Walks Manager downgraded to a hyphen", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWithDescriptions(
        "Officers 2023-24 - Chairman - Colin",
        "Officers 2023-24 — Chairman — Colin") as any);
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
