import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";

import { DbUtilsService } from "./db-utils.service";
import { StringUtilsService } from "./string-utils.service";

describe("DbUtilsService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule, RouterTestingModule],
    providers: [StringUtilsService, MemberIdToFullNamePipe, FullNamePipe, FullNameWithAliasPipe]

  }));

  it("should extract mongo duplicate message", () => {
    const service: DbUtilsService = TestBed.inject(DbUtilsService);
    expect(service.duplicateErrorFields("Unexpected error saving member - MongoError: E11000 duplicate key error index: nbarrett.members.$lastName_1_firstName_1_nameAlias_1 dup key: { : \"Barrett\", : \"Nick\", : \"nick.barrett\" }"))
      .toEqual("\"Barrett\", \"Nick\", \"nick.barrett\"");
  });
});
