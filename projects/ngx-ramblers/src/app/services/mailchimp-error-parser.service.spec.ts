import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";

import { MailchimpErrorParserService } from "./mailchimp-error-parser.service";
import { StringUtilsService } from "./string-utils.service";

describe("MailchimpErrorParserService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule, RouterTestingModule],
    providers: [StringUtilsService, MemberIdToFullNamePipe, FullNamePipe, FullNameWithAliasPipe]
  }));

  it("should be created", () => {

    const mailchimpResponse = {
      add_count: 0,
      adds: [],
      update_count: 0,
      updates: [],
      error_count: 1,
      errors: [
        {
          code: 213,
          error: "sales2@adaptassure.com has bounced, and cannot be resubscribed",
          email: {
            email: "sales2@adaptassure.com"
          }
        }
      ]
    };
    const service: MailchimpErrorParserService = TestBed.inject(MailchimpErrorParserService);
    expect(service.extractError(mailchimpResponse)).toEqual({
      error: [
        "Code: 213",
        "Email -> Email: sales2@adaptassure.com",
        "Error: sales2@adaptassure.com has bounced, and cannot be resubscribed",
      ].join(", ")
    });
  });
});
