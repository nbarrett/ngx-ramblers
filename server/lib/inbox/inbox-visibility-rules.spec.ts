import expect from "expect";
import { describe, it } from "mocha";
import { specialVisibilityGrants } from "./inbox-visibility-rules";

describe("specialVisibilityGrants (junk/other special-inbox visibility)", () => {

  it("denies when there is no visibility config (admin-only default)", () => {
    expect(specialVisibilityGrants(undefined, ["treasurer"])).toBe(false);
  });

  it("denies when 'all role-holders' is not explicitly enabled and no roles are shared", () => {
    expect(specialVisibilityGrants({inboxVisibleToAllRoles: false, inboxVisibleToRoleTypes: []}, ["treasurer"])).toBe(false);
  });

  it("does not treat an undefined inboxVisibleToAllRoles as visible-to-all", () => {
    expect(specialVisibilityGrants({inboxVisibleToRoleTypes: ["social"]}, ["treasurer"])).toBe(false);
  });

  it("grants when 'all role-holders' is explicitly enabled", () => {
    expect(specialVisibilityGrants({inboxVisibleToAllRoles: true}, ["treasurer"])).toBe(true);
  });

  it("grants when a role the member holds is shared", () => {
    expect(specialVisibilityGrants({inboxVisibleToAllRoles: false, inboxVisibleToRoleTypes: ["treasurer", "social"]}, ["treasurer"])).toBe(true);
  });

  it("denies when only roles the member does not hold are shared", () => {
    expect(specialVisibilityGrants({inboxVisibleToAllRoles: false, inboxVisibleToRoleTypes: ["social"]}, ["treasurer"])).toBe(false);
  });
});
