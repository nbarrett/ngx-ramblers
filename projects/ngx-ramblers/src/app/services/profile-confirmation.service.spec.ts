import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";

import { ProfileConfirmationService } from "./profile-confirmation.service";
import { StringUtilsService } from "./string-utils.service";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

describe("ProfileConfirmationService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, RouterTestingModule],
    providers: [StringUtilsService, MemberIdToFullNamePipe, FullNamePipe, FullNameWithAliasPipe, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
}));

  it("should be created", () => {
    const service: ProfileConfirmationService = TestBed.inject(ProfileConfirmationService);
    expect(service).toBeTruthy();
  });
});
