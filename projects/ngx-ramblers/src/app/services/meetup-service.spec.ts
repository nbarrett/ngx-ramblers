import { HttpClient, HttpHandler } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";

import { MeetupService } from "./meetup.service";

describe("MeetupService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, RouterTestingModule],
    providers: [MemberIdToFullNamePipe, FullNameWithAliasPipe, FullNamePipe, HttpClient, HttpHandler,
      {provide: "ConfigData", useValue: {}},
      {provide: "MemberService", useValue: {}}
    ]
  }));

  it("should show complete list of statuses", () => {
    const service: MeetupService = TestBed.inject(MeetupService);
    expect(service.eventStatuses()).toEqual(["past", "upcoming", "draft", "published", "proposed", "suggested"]);
  });

  it("should show complete list of publish statuses", () => {
    const service: MeetupService = TestBed.inject(MeetupService);
    expect(service.publishStatuses()).toEqual(["draft", "published"]);
  });
});
