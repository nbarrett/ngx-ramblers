import expect from "expect";
import { validateViewAsPermissionChange } from "./view-as-permission";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";

const prior = {id: "target", firstName: "Alex", lastName: "Reed", memberAdmin: true, viewAsMember: false} as Member;

describe("View as permission management", () => {
  it("allows a member administrator to grant access to another member", () => {
    expect(() => validateViewAsPermissionChange({memberId: "administrator", memberAdmin: true}, prior, {...prior, viewAsMember: true})).not.toThrow();
  });

  it("allows a member administrator to grant themselves access", () => {
    expect(() => validateViewAsPermissionChange({memberId: prior.id, memberAdmin: true}, prior, {...prior, viewAsMember: true})).not.toThrow();
  });

  it("rejects grants by other administrators without Member Admin", () => {
    expect(() => validateViewAsPermissionChange({memberId: "administrator", contentAdmin: true}, prior, {...prior, viewAsMember: true})).toThrow();
  });

  it("rejects values that would be coerced into a grant by storage", () => {
    expect(() => validateViewAsPermissionChange({memberId: prior.id, memberAdmin: true}, prior, {...prior, viewAsMember: "true"} as unknown as Member)).toThrow();
  });

  it("rejects anonymous grants", () => {
    expect(() => validateViewAsPermissionChange(null, prior, {...prior, viewAsMember: true})).toThrow();
  });

  it("allows normal profile saves with an unchanged grant", () => {
    expect(() => validateViewAsPermissionChange({memberId: prior.id}, prior, {...prior, firstName: "Morgan"})).not.toThrow();
  });

  it("prevents self-elevating to Member Admin before granting access elsewhere", () => {
    expect(() => validateViewAsPermissionChange({memberId: prior.id}, {...prior, memberAdmin: false}, prior)).toThrow();
  });

  it("prevents activating an existing grant by self-enabling Member Admin", () => {
    expect(() => validateViewAsPermissionChange({memberId: prior.id}, {...prior, memberAdmin: false, viewAsMember: true}, {...prior, viewAsMember: true})).toThrow();
  });
});
