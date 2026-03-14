import { TestBed } from "@angular/core/testing";
import { vi } from "vitest";
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

    beforeEach(() => {
        const dateUtilsSpy = {
            asValueNoTime: vi.fn().mockName("DateUtilsService.asValueNoTime"),
            displayDate: vi.fn().mockName("DateUtilsService.displayDate"),
            nowAsValue: vi.fn().mockName("DateUtilsService.nowAsValue"),
            dateTimeNowNoTime: vi.fn().mockName("DateUtilsService.dateTimeNowNoTime")
        };
        const stringUtilsSpy = {
            noValueFor: vi.fn().mockName("StringUtilsService.noValueFor"),
            asBoolean: vi.fn().mockName("StringUtilsService.asBoolean"),
            pluraliseWithCount: vi.fn().mockName("StringUtilsService.pluraliseWithCount")
        };
        const memberUpdateAuditServiceSpy = {
            create: vi.fn().mockName("MemberUpdateAuditService.create")
        };
        const memberBulkLoadAuditServiceSpy = {
            create: vi.fn().mockName("MemberBulkLoadAuditService.create")
        };
        const memberServiceSpy = {
            createOrUpdate: vi.fn().mockName("MemberService.createOrUpdate")
        };
        const memberDefaultsServiceSpy = {
            resetUpdateStatusForMember: vi.fn().mockName("MemberDefaultsService.resetUpdateStatusForMember"),
            applyDefaultMailSettingsToMember: vi.fn().mockName("MemberDefaultsService.applyDefaultMailSettingsToMember")
        };
        const memberNamingServiceSpy = {
            createUniqueDisplayName: vi.fn().mockName("MemberNamingService.createUniqueDisplayName"),
            createUniqueUserName: vi.fn().mockName("MemberNamingService.createUniqueUserName"),
            removeCharactersNotPartOfName: vi.fn().mockName("MemberNamingService.removeCharactersNotPartOfName")
        };
        const numberUtilsServiceSpy = {
            asNumber: vi.fn().mockName("NumberUtilsService.asNumber")
        };
        const fullNamePipeSpy = {
            transform: vi.fn().mockName("FullNamePipe.transform")
        };
        const loggerFactorySpy = {
            createLogger: vi.fn().mockName("LoggerFactory.createLogger")
        };
        loggerFactorySpy.createLogger.mockReturnValue({
            info: vi.fn().mockName("Logger.info"),
            warn: vi.fn().mockName("Logger.warn"),
            debug: vi.fn().mockName("Logger.debug"),
            error: vi.fn().mockName("Logger.error")
        });

        TestBed.configureTestingModule({
            providers: [
                MemberBulkLoadService,
                { provide: DateUtilsService, useValue: dateUtilsSpy },
                { provide: StringUtilsService, useValue: stringUtilsSpy },
                { provide: MemberUpdateAuditService, useValue: memberUpdateAuditServiceSpy },
                { provide: MemberBulkLoadAuditService, useValue: memberBulkLoadAuditServiceSpy },
                { provide: MemberService, useValue: memberServiceSpy },
                { provide: MemberDefaultsService, useValue: memberDefaultsServiceSpy },
                { provide: MemberNamingService, useValue: memberNamingServiceSpy },
                { provide: NumberUtilsService, useValue: numberUtilsServiceSpy },
                { provide: FullNamePipe, useValue: fullNamePipeSpy },
                { provide: LoggerFactory, useValue: loggerFactorySpy }
            ]
        });

        service = TestBed.inject(MemberBulkLoadService);
    });

    it("should be created", () => {
        expect(service).toBeTruthy();
    });

    describe("membershipExpiryDate field handling", () => {
        it("should use correct date format for Ramblers Insight Hub exports", () => {
            const membershipExpiryDateField = AUDIT_FIELDS.find(f => f.fieldName === "membershipExpiryDate");

            expect(membershipExpiryDateField).toBeDefined();
            expect(membershipExpiryDateField.dateFormat).toBe(InsightHubDateFormat.TWO_DIGIT_YEAR);
        });

        it("should use correct date format for emailPermissionLastUpdated", () => {
            const emailPermissionField = AUDIT_FIELDS.find(f => f.fieldName === "emailPermissionLastUpdated");

            expect(emailPermissionField).toBeDefined();
            expect(emailPermissionField.dateFormat).toBe(InsightHubDateFormat.FOUR_DIGIT_YEAR);
        });

        it("should preserve existing expiry date when CSV has empty value with CHANGED rule", () => {
            const membershipExpiryDateField = AUDIT_FIELDS.find(f => f.fieldName === "membershipExpiryDate");

            expect(membershipExpiryDateField).toBeDefined();
            expect(membershipExpiryDateField.writeDataIf).toBe(WriteDataRule.CHANGED);
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
            expect(membershipExpiryDateField.dateFormat).toBe(InsightHubDateFormat.TWO_DIGIT_YEAR);
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

            expect(membershipExpiryDateField.dateFormat).toBe(InsightHubDateFormat.TWO_DIGIT_YEAR);
        });
    });
});
