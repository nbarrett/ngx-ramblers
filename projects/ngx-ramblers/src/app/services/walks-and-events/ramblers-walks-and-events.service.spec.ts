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

describe("RamblersWalksAndEventsService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule],
    providers: [
      RamblersWalksAndEventsService,
      DisplayDatePipe,
      DateUtilsService,
      WalkDisplayService,
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
      }
    ]
  }));

  it("should be created", () => {
    const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
    expect(service).toBeTruthy();
  });

  describe("toWalkExport", () => {
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

    it("still flags a genuine title difference and marks the walk for republishing", () => {
      const service: RamblersWalksAndEventsService = TestBed.inject(RamblersWalksAndEventsService);
      const walkExport = service.toWalkExport(publishedWalkWith("Hythe and Saltwood extended circular", "Hythe and Saltwood circular") as any);
      expect(walkExport.publishStatus.messages.some(message => message.startsWith("Ramblers title is"))).toBe(true);
      expect(walkExport.publishStatus.publish).toBe(true);
    });
  });
});
