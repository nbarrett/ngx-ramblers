import { TestBed } from "@angular/core/testing";
import { ReplaySubject } from "rxjs";
import { LoggerTestingModule } from "ngx-logger/testing";
import { AccessLevel } from "../../models/member-resource.model";
import { MobileAppAction, WalksConfig } from "../../models/walks-config.model";
import { MemberLoginService } from "../member/member-login.service";
import { WalksConfigService } from "../system/walks-config.service";
import { UiActionsService } from "../ui-actions.service";
import { MobileAppAccessService } from "./mobile-app-access.service";

describe("MobileAppAccessService first launch", () => {
  it("waits for the restricted configuration instead of granting default public access", async () => {
    const events = new ReplaySubject<WalksConfig>(1);
    const state = {config: null as WalksConfig | null, resolve: null as ((config: WalksConfig) => void) | null};
    const loaded = new Promise<WalksConfig>(resolve => state.resolve = resolve);
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        {provide: WalksConfigService, useValue: {events: () => events, walksConfig: () => state.config, walksConfigLoaded: () => loaded}},
        {provide: MemberLoginService, useValue: {loggedInMember: () => null}},
        {provide: UiActionsService, useValue: {initialObjectValueFor: () => null, saveValueFor: vi.fn()}}
      ]
    });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const access = TestBed.inject(MobileAppAccessService);
    expect(access.allowed(MobileAppAction.ACCESS)).toBe(false);
    const pending = access.ready();
    state.config = {mobileApp: {access: AccessLevel.HIDDEN}} as WalksConfig;
    events.next(state.config);
    state.resolve(state.config);
    await pending;
    expect(access.allowed(MobileAppAction.ACCESS)).toBe(false);
  });
});
