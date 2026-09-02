import { RiskAssessmentService } from "./risk-assessment.service";
import { StringUtilsService } from "../string-utils.service";
import { LoggerFactory } from "../logger-factory.service";
import { RiskAssessmentRecord } from "../../models/walk.model";
import { DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS } from "../../models/walks-config.model";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";

describe("RiskAssessmentService", () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [RiskAssessmentService, StringUtilsService, LoggerFactory]
    });
    service = TestBed.inject(RiskAssessmentService);
  });

  const confirmed = (key: string, title: string): RiskAssessmentRecord => ({
    memberId: "member-1",
    confirmed: true,
    confirmationDate: 1,
    riskAssessmentKey: key,
    riskAssessmentSection: title
  });

  it("treats an empty list as incomplete for the default sections", () => {
    expect(service.unconfirmedRiskAssessmentsExist([])).toBe(true);
    expect(service.unconfirmedSections([]).map(section => section.key))
      .toEqual(DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS.map(section => section.key));
  });

  it("does not require sections when the group list is empty", () => {
    expect(service.unconfirmedRiskAssessmentsExist([], [])).toBe(false);
  });

  it("is complete only when every configured section is confirmed", () => {
    const records = DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS.map(section => confirmed(section.key, section.title));
    expect(service.unconfirmedRiskAssessmentsExist(records)).toBe(false);
    expect(service.successMessage(records).title).toEqual("Risk Assessment complete");
  });

  it("names the sections that are still outstanding", () => {
    const records = [confirmed("traffic", "Traffic")];
    const message = service.warningMessage(records);
    expect(message.title).toEqual("Risk Assessment not yet complete");
    expect(message.message).toContain("Path surface and obstacles");
    expect(message.message).not.toContain("Traffic");
  });

  it("uses the group's section list when provided", () => {
    const sections = [{key: "weather", title: "Weather"}];
    expect(service.unconfirmedRiskAssessmentsExist([], sections)).toBe(true);
    expect(service.unconfirmedRiskAssessmentsExist([confirmed("weather", "Weather")], sections)).toBe(false);
  });
});
