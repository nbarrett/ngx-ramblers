import { AccessLevel } from "../models/member-resource.model";
import { eventAccessPermitted } from "./event-access-level";

describe("eventAccessPermitted", () => {
  const visitor = {loggedIn: false, committee: false, memberAdmin: false, eventAdmin: false, eventLeader: false};
  const member = {loggedIn: true, committee: false, memberAdmin: false, eventAdmin: false, eventLeader: false};

  it("allows not-logged-in access only for visitors", () => {
    expect(eventAccessPermitted(AccessLevel.NOT_LOGGED_IN, visitor)).toBe(true);
    expect(eventAccessPermitted(AccessLevel.NOT_LOGGED_IN, member)).toBe(false);
  });

  it("allows logged-in-member access only after login", () => {
    expect(eventAccessPermitted(AccessLevel.LOGGED_IN_MEMBER, visitor)).toBe(false);
    expect(eventAccessPermitted(AccessLevel.LOGGED_IN_MEMBER, member)).toBe(true);
  });
});
