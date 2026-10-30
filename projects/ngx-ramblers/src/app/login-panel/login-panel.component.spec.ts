import {TestBed} from "@angular/core/testing";
import {LoggerTestingModule} from "ngx-logger/testing";
import {BsModalService} from "ngx-bootstrap/modal";
import {AuthService} from "../auth/auth.service";
import {BroadcastService} from "../services/broadcast-service";
import {MemberLoginService} from "../services/member/member-login.service";
import {RouterHistoryService} from "../services/router-history.service";
import {SystemConfigService} from "../services/system/system-config.service";
import {ViewAsService} from "../services/member/view-as.service";
import {NamedEvent, NamedEventType} from "../models/broadcast.model";
import {LoginModalComponent} from "../pages/login/login-modal/login-modal.component";
import {ForgotPasswordModalComponent} from "../pages/login/forgot-password-modal/forgot-password-modal.component";
import {LoginPanelComponent} from "./login-panel.component";

describe("login panel mobile menu actions", () => {
  const broadcast = vi.fn();
  const show = vi.fn();

  beforeEach(() => {
    broadcast.mockReset();
    show.mockReset();
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        {provide: MemberLoginService, useValue: {memberLoggedIn: () => false}},
        {provide: AuthService, useValue: {}},
        {provide: BsModalService, useValue: {show}},
        {provide: BroadcastService, useValue: {broadcast}},
        {provide: SystemConfigService, useValue: {}},
        {provide: RouterHistoryService, useValue: {}},
        {provide: ViewAsService, useValue: {}}
      ]
    });
  });

  it("closes the menu before showing login", () => {
    const component = TestBed.runInInjectionContext(() => new LoginPanelComponent());
    component.loginOrLogout();
    expect(broadcast).toHaveBeenCalledWith(NamedEvent.withData(NamedEventType.MENU_TOGGLE, false));
    expect(show).toHaveBeenCalledWith(LoginModalComponent, component.config);
    expect(broadcast.mock.invocationCallOrder[0]).toBeLessThan(show.mock.invocationCallOrder[0]);
  });

  it("closes the menu before showing password recovery", () => {
    const component = TestBed.runInInjectionContext(() => new LoginPanelComponent());
    component.forgotPassword();
    expect(broadcast).toHaveBeenCalledWith(NamedEvent.withData(NamedEventType.MENU_TOGGLE, false));
    expect(show).toHaveBeenCalledWith(ForgotPasswordModalComponent, component.config);
    expect(broadcast.mock.invocationCallOrder[0]).toBeLessThan(show.mock.invocationCallOrder[0]);
  });
});
