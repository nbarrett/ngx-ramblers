import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../../pipes/member-id-to-full-name.pipe";
import { MemberNamingService } from "./member-naming.service";

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

describe("MemberNamingService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule, RouterTestingModule],
    providers: [MemberIdToFullNamePipe,
      FullNamePipe,
      FullNameWithAliasPipe]
  }));

  it("createUniqueUserName should generate the next available username were none exist already", () => {
    const service: MemberNamingService = TestBed.inject(MemberNamingService);
    expect(service.createUniqueUserName({
      firstName: "John",
      lastName: "Grant"
    }, [])).toEqual("john.grant");
  });

  it("createUniqueUserName should generate the next available username were some exist already", () => {
    const service: MemberNamingService = TestBed.inject(MemberNamingService);
    expect(service.createUniqueUserName({
      firstName: "John",
      lastName: "Grant"
    }, twoJohns)).toEqual("john.grant2");
  });

  it("createDisplayName should generate the next available display name were some exist already", () => {
    const service: MemberNamingService = TestBed.inject(MemberNamingService);
    expect(service.createUniqueDisplayName({
      firstName: "John",
      lastName: "Grant"
    }, twoJohns)).toEqual("John G2");
  });

  it("createDisplayName should generate the next available display name were none exist already", () => {
    const service: MemberNamingService = TestBed.inject(MemberNamingService);
    expect(service.createUniqueDisplayName({
      firstName: "John",
      lastName: "Grant"
    }, [])).toEqual("John G");
  });

  it("firstAndLastNameFrom should generate a nam from a single string input", () => {
    const service: MemberNamingService = TestBed.inject(MemberNamingService);
    expect(service.firstAndLastNameFrom("John Grant")).toEqual({firstName: "John", lastName: "Grant"});
  });

  it("firstAndLastNameFrom should accept a hyphenated a name", () => {
    const service: MemberNamingService = TestBed.inject(MemberNamingService);
    expect(service.firstAndLastNameFrom("John Hyphenated-Grant")).toEqual({
      firstName: "John",
      lastName: "Hyphenated-Grant"
    });
  });

  it("firstAndLastNameFrom should accept a hyphenated a name", () => {
    const service: MemberNamingService = TestBed.inject(MemberNamingService);
    expect(service.firstAndLastNameFrom(null)).toEqual(null);
  });
})
