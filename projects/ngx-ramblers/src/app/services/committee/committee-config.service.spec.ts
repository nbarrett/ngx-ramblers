import { TestBed } from "@angular/core/testing";
import { CommitteeConfigService } from "./commitee-config.service";
import { ConfigService } from "../config.service";
import { LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";

describe("CommitteeConfigService", () => {
  let service: CommitteeConfigService;

  beforeEach(() => {
    const configService = {
      queryConfig: jasmine.createSpy("queryConfig").and.returnValue(Promise.resolve({})),
      saveConfig: jasmine.createSpy("saveConfig")
    };
    const loggerFactory = {
      createLogger: jasmine.createSpy("createLogger").and.returnValue({
        info: jasmine.createSpy("info"),
        error: jasmine.createSpy("error"),
        warn: jasmine.createSpy("warn"),
        debug: jasmine.createSpy("debug"),
        off: jasmine.createSpy("off")
      })
    };
    const memberLoginService = {};

    TestBed.configureTestingModule({
      providers: [
        CommitteeConfigService,
        { provide: ConfigService, useValue: configService },
        { provide: LoggerFactory, useValue: loggerFactory },
        { provide: MemberLoginService, useValue: memberLoginService }
      ]
    });

    service = TestBed.inject(CommitteeConfigService);
  });

  it("nameAndDescriptionFrom should avoid duplicate names", () => {
    const result = service.nameAndDescriptionFrom({ description: "Info", fullName: "Info" } as any);
    expect(result).toBe("Info");
  });

  it("nameAndDescriptionFrom should be case-insensitive when matching", () => {
    const result = service.nameAndDescriptionFrom({ description: "Info", fullName: "info" } as any);
    expect(result).toBe("Info");
  });

  it("nameAndDescriptionFrom should include full name when different", () => {
    const result = service.nameAndDescriptionFrom({ description: "Info", fullName: "Bob Smith" } as any);
    expect(result).toBe("Info (Bob Smith)");
  });

  it("nameAndDescriptionFrom should avoid double brackets when full name is already bracketed", () => {
    const result = service.nameAndDescriptionFrom({ description: "Support", fullName: "(Vacant)" } as any);
    expect(result).toBe("Support (Vacant)");
  });

  it("nameAndDescriptionFrom should return full name when description missing", () => {
    const result = service.nameAndDescriptionFrom({ description: "", fullName: "Bob" } as any);
    expect(result).toBe("Bob");
  });

  it("nameAndDescriptionFrom should return description when full name missing", () => {
    const result = service.nameAndDescriptionFrom({ description: "Info", fullName: "" } as any);
    expect(result).toBe("Info");
  });

  it("nameAndDescriptionFrom should trim input values", () => {
    const result = service.nameAndDescriptionFrom({ description: "  Info ", fullName: "  Bob " } as any);
    expect(result).toBe("Info (Bob)");
  });

  it("nameAndDescriptionFrom should return empty string when both values missing", () => {
    const result = service.nameAndDescriptionFrom({ description: "", fullName: "" } as any);
    expect(result).toBe("");
  });
});
