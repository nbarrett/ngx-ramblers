import expect from "expect";
import { describe, it } from "mocha";
import { RamblersMember } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { SalesforceMember } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { rebuildFullMemberList } from "./salesforce-sync";

function ramblersMember(membershipNumber: string, firstName = "Member"): RamblersMember {
  return { membershipNumber, firstName } as RamblersMember;
}

function salesforceMember(membershipNumber: string): SalesforceMember {
  return { membershipNumber } as SalesforceMember;
}

function salesforceRamblersMember(salesforceId: string, membershipNumber: string | null, firstName = "Member"): RamblersMember {
  return { salesforceId, membershipNumber, firstName } as RamblersMember;
}

describe("salesforce-sync rebuildFullMemberList", () => {

  it("subtracts removed members from the previously loaded list", () => {
    const previous = [ramblersMember("1"), ramblersMember("2"), ramblersMember("3")];
    const result = rebuildFullMemberList(previous, [], [salesforceMember("2")]);
    expect(result.map(member => member.membershipNumber)).toEqual(["1", "3"]);
  });

  it("appends added members to the previously loaded list", () => {
    const previous = [ramblersMember("1"), ramblersMember("2")];
    const result = rebuildFullMemberList(previous, [ramblersMember("9")], []);
    expect(result.map(member => member.membershipNumber)).toEqual(["1", "2", "9"]);
  });

  it("replaces an amended member in place without duplicating it", () => {
    const previous = [ramblersMember("1", "Old"), ramblersMember("2", "Stable")];
    const result = rebuildFullMemberList(previous, [ramblersMember("1", "New")], []);
    expect(result).toHaveLength(2);
    expect(result.find(member => member.membershipNumber === "1")?.firstName).toEqual("New");
  });

  it("applies removals, amendments and additions together", () => {
    const previous = [ramblersMember("1"), ramblersMember("2"), ramblersMember("3")];
    const additions = [ramblersMember("2", "Amended"), ramblersMember("4"), ramblersMember("5")];
    const result = rebuildFullMemberList(previous, additions, [salesforceMember("3")]);
    expect(result.map(member => member.membershipNumber)).toEqual(["1", "2", "4", "5"]);
  });

  it("returns the previously loaded list unchanged when there is no delta", () => {
    const previous = [ramblersMember("1"), ramblersMember("2")];
    const result = rebuildFullMemberList(previous, [], []);
    expect(result.map(member => member.membershipNumber)).toEqual(["1", "2"]);
  });

  it("retains members with no identity keys (manually created or non-Ramblers) when a sync runs", () => {
    const manual = { firstName: "Manual" } as RamblersMember;
    const previous = [ramblersMember("1"), manual];
    const result = rebuildFullMemberList(previous, [ramblersMember("9")], [salesforceMember("1")]);
    expect(result).toHaveLength(2);
    expect(result.map(member => member.firstName)).toContain("Manual");
  });

  it("replaces a member matched on salesforceId even when its membership number changes", () => {
    const previous = [salesforceRamblersMember("SF1", "1", "Old")];
    const result = rebuildFullMemberList(previous, [salesforceRamblersMember("SF1", "2", "New")], []);
    expect(result).toHaveLength(1);
    expect(result[0].membershipNumber).toEqual("2");
    expect(result[0].firstName).toEqual("New");
  });

  it("supersedes a legacy member whose salesforceId had been stored as its membership number", () => {
    const legacy = ramblersMember("SF1", "Legacy");
    const result = rebuildFullMemberList([legacy], [salesforceRamblersMember("SF1", null, "Reconciled")], []);
    expect(result).toHaveLength(1);
    expect(result[0].firstName).toEqual("Reconciled");
  });

});
