import { TestBed } from "@angular/core/testing";
import { MemberBulkLoadService } from "./member-bulk-load.service";
import { Member, RamblersMember, WriteDataRule } from "../../models/member.model";
import { AUDIT_FIELDS, InsightHubDateFormat } from "../../models/ramblers-insight-hub";
import { DateUtilsService } from "../date-utils.service";
import { LoggerFactory } from "../logger-factory.service";
import { MemberUpdateAuditService } from "./member-update-audit.service";
import { MemberBulkLoadAuditService } from "./member-bulk-load-audit.service";
import { MemberService } from "./member.service";
import { MemberDefaultsService } from "./member-defaults.service";
import { MemberNamingService } from "./member-naming.service";
import { NumberUtilsService } from "../number-utils.service";
import { StringUtilsService } from "../string-utils.service";
import { FullNamePipe } from "../../pipes/full-name.pipe";

describe("MemberBulkLoadService", () => {
  let service: MemberBulkLoadService;
  let dateUtils: jasmine.SpyObj<DateUtilsService>;
  let stringUtils: jasmine.SpyObj<StringUtilsService>;

  beforeEach(() => {
    const dateUtilsSpy = jasmine.createSpyObj("DateUtilsService", [
      "asValueNoTime",
      "displayDate",
      "nowAsValue",
      "dateTimeNowNoTime"
    ]);
    const stringUtilsSpy = jasmine.createSpyObj("StringUtilsService", [
      "noValueFor",
      "asBoolean",
      "pluraliseWithCount"
    ]);
    const memberUpdateAuditServiceSpy = jasmine.createSpyObj("MemberUpdateAuditService", ["create"]);
    const memberBulkLoadAuditServiceSpy = jasmine.createSpyObj("MemberBulkLoadAuditService", ["create"]);
    const memberServiceSpy = jasmine.createSpyObj("MemberService", ["createOrUpdate"]);
    const memberDefaultsServiceSpy = jasmine.createSpyObj("MemberDefaultsService", ["resetUpdateStatusForMember", "applyDefaultMailSettingsToMember"]);
    const memberNamingServiceSpy = jasmine.createSpyObj("MemberNamingService", ["createUniqueDisplayName", "createUniqueUserName", "removeCharactersNotPartOfName"]);
    const numberUtilsServiceSpy = jasmine.createSpyObj("NumberUtilsService", ["asNumber"]);
    const fullNamePipeSpy = jasmine.createSpyObj("FullNamePipe", ["transform"]);
    const loggerFactorySpy = jasmine.createSpyObj("LoggerFactory", ["createLogger"]);
    loggerFactorySpy.createLogger.and.returnValue(jasmine.createSpyObj("Logger", ["info", "warn", "debug", "error"]));

    TestBed.configureTestingModule({
      providers: [
        MemberBulkLoadService,
        {provide: DateUtilsService, useValue: dateUtilsSpy},
        {provide: StringUtilsService, useValue: stringUtilsSpy},
        {provide: MemberUpdateAuditService, useValue: memberUpdateAuditServiceSpy},
        {provide: MemberBulkLoadAuditService, useValue: memberBulkLoadAuditServiceSpy},
        {provide: MemberService, useValue: memberServiceSpy},
        {provide: MemberDefaultsService, useValue: memberDefaultsServiceSpy},
        {provide: MemberNamingService, useValue: memberNamingServiceSpy},
        {provide: NumberUtilsService, useValue: numberUtilsServiceSpy},
        {provide: FullNamePipe, useValue: fullNamePipeSpy},
        {provide: LoggerFactory, useValue: loggerFactorySpy}
      ]
    });

    service = TestBed.inject(MemberBulkLoadService);
    dateUtils = TestBed.inject(DateUtilsService) as jasmine.SpyObj<DateUtilsService>;
    stringUtils = TestBed.inject(StringUtilsService) as jasmine.SpyObj<StringUtilsService>;
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("membershipExpiryDate field handling", () => {
    it("should use correct date format for Ramblers Insight Hub exports", () => {
      const membershipExpiryDateField = AUDIT_FIELDS.find(f => f.fieldName === "membershipExpiryDate");

      expect(membershipExpiryDateField).toBeDefined();
      expect(membershipExpiryDateField.dateFormat).toBe(InsightHubDateFormat.TWO_DIGIT_YEAR,
        "membershipExpiryDate should use TWO_DIGIT_YEAR format (dd/MM/yy) to match Ramblers Insight Hub Excel export format");
    });

    it("should use correct date format for emailPermissionLastUpdated", () => {
      const emailPermissionField = AUDIT_FIELDS.find(f => f.fieldName === "emailPermissionLastUpdated");

      expect(emailPermissionField).toBeDefined();
      expect(emailPermissionField.dateFormat).toBe(InsightHubDateFormat.FOUR_DIGIT_YEAR,
        "emailPermissionLastUpdated should use FOUR_DIGIT_YEAR format (dd/MM/yyyy) as it has 4-digit years in Excel");
    });

    it("should preserve existing expiry date when CSV has empty value with CHANGED rule", () => {
      const membershipExpiryDateField = AUDIT_FIELDS.find(f => f.fieldName === "membershipExpiryDate");

      expect(membershipExpiryDateField).toBeDefined();
      expect(membershipExpiryDateField.writeDataIf).toBe(WriteDataRule.CHANGED,
        "membershipExpiryDate uses CHANGED rule which only updates if ramblersMember has a value");
    });

    it("should correctly parse dates in dd/MM/yy format from Insight Hub", () => {
      const membershipExpiryDateField = AUDIT_FIELDS.find(f => f.fieldName === "membershipExpiryDate");

      expect(membershipExpiryDateField.dateFormat).toBe(InsightHubDateFormat.TWO_DIGIT_YEAR);
      expect(membershipExpiryDateField.type).toBe("date");
    });
  });

  describe("regression tests for issue #73", () => {
    it("should use dd/MM/yy format to prevent date parsing failures", () => {
      const membershipExpiryDateField = AUDIT_FIELDS.find(f => f.fieldName === "membershipExpiryDate");

      expect(membershipExpiryDateField).toBeDefined();
      expect(membershipExpiryDateField.dateFormat).toBe(InsightHubDateFormat.TWO_DIGIT_YEAR,
        "Using correct date format prevents parsing failures that would clear existing expiry dates");
    });

    it("should maintain AUDIT_FIELDS configuration for membershipExpiryDate", () => {
      const field = AUDIT_FIELDS.find(f => f.fieldName === "membershipExpiryDate");

      expect(field).toBeDefined();
      expect(field.fieldName).toBe("membershipExpiryDate");
      expect(field.writeDataIf).toBe(WriteDataRule.CHANGED);
      expect(field.type).toBe("date");
      expect(field.dateFormat).toBe(InsightHubDateFormat.TWO_DIGIT_YEAR);
    });

    it("should handle dates in format like 15/07/26 from Excel", () => {
      const membershipExpiryDateField = AUDIT_FIELDS.find(f => f.fieldName === "membershipExpiryDate");

      expect(membershipExpiryDateField.dateFormat).toBe(InsightHubDateFormat.TWO_DIGIT_YEAR,
        "Date format matches the actual format in Ramblers Insight Hub Excel exports (e.g., 15/07/26)");
    });
  });
});
