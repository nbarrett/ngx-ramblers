import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";
import { CommonDataService } from "./common-data-service";
import { StringUtilsService } from "./string-utils.service";

const criteria = {
  memberId: "12324"
};
const select = {
  mailchimpLists: 1,
  groupMember: 1,
  socialMember: 1
};
const input = {
  criteria, select
};

describe("CommonDataService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule],
    providers: [StringUtilsService, MemberIdToFullNamePipe, FullNamePipe, FullNameWithAliasPipe]
  }));

  it("should return keys of complex input", () => {
    const service: CommonDataService = TestBed.inject(CommonDataService);
    const httpParams = service.toHttpParams(input);
    expect(httpParams.keys()).toEqual(["criteria", "select"]);
  });

  it("should return individual keys of complex input that match inputs", () => {
    const service: CommonDataService = TestBed.inject(CommonDataService);
    const httpParams = service.toHttpParams(input);
    expect(httpParams.get("criteria")).toEqual(JSON.stringify(criteria) as any);
    expect(httpParams.get("select")).toEqual(JSON.stringify(select) as any);
  });

  it("should return keys of simple input", () => {
    const service: CommonDataService = TestBed.inject(CommonDataService);
    const httpParams = service.toHttpParams(criteria);
    expect(httpParams.keys()).toEqual(["memberId"]);
  });

  it("should return individual keys of simple input that match inputs", () => {
    const service: CommonDataService = TestBed.inject(CommonDataService);
    const httpParams = service.toHttpParams(criteria);
    expect(httpParams.toString()).toEqual("memberId=12324");
  });
});
