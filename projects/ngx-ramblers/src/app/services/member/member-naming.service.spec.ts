import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../../pipes/member-id-to-full-name.pipe";
import { MemberNamingService } from "./member-naming.service";
import { Member } from "../../models/member.model";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

const twoJohns = [{
  firstName: "John",
  lastName: "Grant",
  userName: "john.grant",
  displayName: "John G"
}, {
  firstName: "John",
  lastName: "Grant",
  userName: "john.grant1",
  displayName: "John G1"
}];

const withDot = {
  firstName: "Carol",
  lastName: "M.",
  userName: "Carol.m",
  displayName: "John M"
};

describe("MemberNamingService", () => {
  let service: MemberNamingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [LoggerTestingModule, RouterTestingModule],
    providers: [MemberIdToFullNamePipe, FullNamePipe, FullNameWithAliasPipe, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(MemberNamingService);
  });

  it("should create display name without trailing dots", () => {
    const member: Member = { firstName: "Carol", lastName: "M." } as Member;
    const displayName = service.createDisplayNameFromMember(member);
    expect(displayName).toBe("Carol M");
  });

  it("should create display name without trailing dots for empty last name", () => {
    const member: Member = { firstName: "Carol", lastName: "" } as Member;
    const displayName = service.createDisplayNameFromMember(member);
    expect(displayName).toBe("Carol");
  });

  it("should create display name without trailing dots for empty first name", () => {
    const member: Member = { firstName: "", lastName: "M." } as Member;
    const displayName = service.createDisplayNameFromMember(member);
    expect(displayName).toBe("M");
  });

  it("should create display name without trailing dots for both names empty", () => {
    const member: Member = { firstName: "", lastName: "" } as Member;
    const displayName = service.createDisplayNameFromMember(member);
    expect(displayName).toBe("");
  });

  it("createUniqueUserName should generate the next available username were none exist already", () => {
    expect(service.createUniqueUserName({
      firstName: "John",
      lastName: "Grant"
    }, [])).toEqual("john.grant");
  });

  it("createUniqueUserName should generate the names without dots if supplied", () => {
    expect(service.createUniqueUserName(withDot, [])).toEqual("carol.m");
  });

  it("createUniqueUserName should remove spaced from the names if supplied", () => {
    expect(service.createUniqueUserName({
      firstName: "S J",
      lastName: "Tay lor",
      userName: "sj.taylor",
      displayName: "SJ T"
    }, [])).toEqual("sj.taylor");
  });

  it("createUniqueUserName should generate the next available username were some exist already", () => {
    expect(service.createUniqueUserName({
      firstName: "John",
      lastName: "Grant"
    }, twoJohns)).toEqual("john.grant2");
  });

  it("createDisplayName should generate the next available display name were some exist already", () => {
    expect(service.createUniqueDisplayName({
      firstName: "John",
      lastName: "Grant"
    }, twoJohns)).toEqual("John G2");
  });

  it("createDisplayName should generate the next available display name were none exist already", () => {
    expect(service.createUniqueDisplayName({
      firstName: "John",
      lastName: "Grant"
    }, [])).toEqual("John G");
  });

  it("firstAndLastNameFrom should generate a name from a single string input", () => {
    expect(service.firstAndLastNameFrom("John Grant")).toEqual({ firstName: "John", lastName: "Grant" });
  });

  it("firstAndLastNameFrom should accept a hyphenated name", () => {
    expect(service.firstAndLastNameFrom("John Hyphenated-Grant")).toEqual({
      firstName: "John",
      lastName: "Hyphenated-Grant"
    });
  });

  it("firstAndLastNameFrom should return null for null input", () => {
    expect(service.firstAndLastNameFrom(null)).toEqual(null);
  });

  it("should remove spaces and trailing dots", () => {
    const result = service.removeCharactersNotPartOfName("carol m.");
    expect(result).toBe("carol m");
  });

  it("should remove spaces and trailing dots and spaces", () => {
    const result = service.removeCharactersNotPartOfName("carol m.    ");
    expect(result).toBe("carol m");
  });

  it("should remove only trailing dots", () => {
    const result = service.removeCharactersNotPartOfName("carolm.");
    expect(result).toBe("carolm");
  });

  it("should remove only spaces", () => {
    const result = service.removeCharactersNotPartOfName("carol m");
    expect(result).toBe("carol m");
  });

  it("should return the same string if no spaces or trailing dots", () => {
    const result = service.removeCharactersNotPartOfName("carolm");
    expect(result).toBe("carolm");
  });

  it("should handle empty string", () => {
    const result = service.removeCharactersNotPartOfName("");
    expect(result).toBe("");
  });

  it("should handle null value", () => {
    const result = service.removeCharactersNotPartOfName(null);
    expect(result).toBe("");
  });
});

describe("MemberNamingService - createUserName", () => {
  let service: MemberNamingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [LoggerTestingModule, RouterTestingModule],
    providers: [MemberIdToFullNamePipe, FullNamePipe, FullNameWithAliasPipe, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(MemberNamingService);
  });

  it("should create username with both first and last names", () => {
    const member: Member = { firstName: "John", lastName: "Doe" } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("john.doe");
  });

  it("should create username with only first name", () => {
    const member: Member = { firstName: "John", lastName: "" } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("john");
  });

  it("should create username with only last name", () => {
    const member: Member = { firstName: "", lastName: "Doe" } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("doe");
  });

  it("should create empty username when both names are empty", () => {
    const member: Member = { firstName: "", lastName: "" } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("");
  });

  it("should create username with both names and remove trailing dots and spaces", () => {
    const member: Member = { firstName: "John ", lastName: "Doe. " } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("john.doe");
  });

  it("should create username with only first name and remove trailing dots and spaces", () => {
    const member: Member = { firstName: "John. ", lastName: "" } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("john");
  });

  it("should create username with only first name and lastname missing remove trailing dots and spaces", () => {
    const member: Member = { firstName: "John. " } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("john");
  });

  it("should create username with only lastname name and firstname missing remove trailing dots and spaces", () => {
    const member: Member = { lastName: "Doe. " } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("doe");
  });

  it("should create username with only last name and remove trailing dots and spaces", () => {
    const member: Member = { firstName: "", lastName: "Doe. " } as Member;
    const userName = service.createUserName(member);
    expect(userName).toBe("doe");
  });
});
