import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { of } from "rxjs";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";
import { MeetupService } from "./meetup.service";
import { WalksConfigService } from "./system/walks-config.service";
import { ConfigService } from "./config.service";
import { LinksService } from "./links.service";
import { DateUtilsService } from "./date-utils.service";
import { StringUtilsService } from "./string-utils.service";
import { CommonDataService } from "./common-data-service";

const walksConfigServiceStub = {
  events: () => of({
    milesPerHour: 2.13,
    requireRiskAssessment: true,
    requireFinishTime: true,
    requireWalkLeaderDisplayName: true
  })
};

describe("MeetupService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, RouterTestingModule],
    providers: [MemberIdToFullNamePipe, FullNameWithAliasPipe, FullNamePipe,
      provideHttpClient(withInterceptorsFromDi()),
      provideHttpClientTesting(),
      {provide: WalksConfigService, useValue: walksConfigServiceStub},
      {provide: ConfigService, useValue: {}},
      {provide: LinksService, useValue: {}},
      {provide: DateUtilsService, useValue: {}},
      {provide: StringUtilsService, useValue: {}},
      {provide: CommonDataService, useValue: {}},
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
