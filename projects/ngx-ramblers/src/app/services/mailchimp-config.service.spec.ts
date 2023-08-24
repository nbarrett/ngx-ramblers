import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";

import { MailchimpConfigService } from "./mailchimp-config.service";
import { StringUtilsService } from "./string-utils.service";

describe("MailchimpConfigService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule, RouterTestingModule],
    providers: [StringUtilsService, MemberIdToFullNamePipe, FullNamePipe, FullNameWithAliasPipe]

  }));

  it("should be created", () => {
    const service: MailchimpConfigService = TestBed.inject(MailchimpConfigService);
    expect(service).toBeTruthy();
  });
});
