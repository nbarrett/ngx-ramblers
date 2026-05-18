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

});
