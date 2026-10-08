import { TestBed } from "@angular/core/testing";
import { AccessLevel } from "../models/member-resource.model";
import { AccessLevelService } from "./access-level.service";
import { MemberLoginService } from "./member/member-login.service";

describe("AccessLevelService", () => {
  const loginState = {loggedIn: false, committee: false, memberAdmin: false};

  beforeEach(() => {
    loginState.loggedIn = false;
    loginState.committee = false;
    loginState.memberAdmin = false;
    TestBed.configureTestingModule({
      providers: [
        AccessLevelService,
        {
          provide: MemberLoginService,
          useValue: {
            memberLoggedIn: () => loginState.loggedIn,
            allowCommittee: () => loginState.committee,
            allowMemberAdminEdits: () => loginState.memberAdmin
          }
        }
      ]
    });
  });

  it("shows not-logged-in items to visitors and hides them from members", () => {
    const service = TestBed.inject(AccessLevelService);
    expect(service.hasAccessLevel(AccessLevel.NOT_LOGGED_IN)).toBe(true);
    loginState.loggedIn = true;
    expect(service.hasAccessLevel(AccessLevel.NOT_LOGGED_IN)).toBe(false);
  });

  it("keeps public items visible whether or not someone is logged in", () => {
    const service = TestBed.inject(AccessLevelService);
    expect(service.hasAccessLevel(AccessLevel.PUBLIC)).toBe(true);
    loginState.loggedIn = true;
    expect(service.hasAccessLevel(AccessLevel.PUBLIC)).toBe(true);
  });

  it("shows logged-in-member items only after login", () => {
    const service = TestBed.inject(AccessLevelService);
    expect(service.hasAccessLevel(AccessLevel.LOGGED_IN_MEMBER)).toBe(false);
    loginState.loggedIn = true;
    expect(service.hasAccessLevel(AccessLevel.LOGGED_IN_MEMBER)).toBe(true);
  });
});
