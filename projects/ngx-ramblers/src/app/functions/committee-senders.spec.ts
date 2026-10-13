import { describe, expect, it } from "vitest";
import { CommitteeConfig, CommitteeMember, RoleType, roleMailboxExtras } from "../models/committee.model";
import { committeeSenderPlans, missingCommitteeSenders, sendingDomainAuthenticated, unregisteredCommitteeSenders } from "./committee-senders";

function chair(): CommitteeMember {
  return {
    description: "Chair",
    email: "chair@group.example.org.uk",
    fullName: "Alex Reed",
    type: "chairman",
    roleType: RoleType.COMMITTEE_MEMBER,
    additionalEmails: ["alex.reed@group.example.org.uk", "alex.reed@example.com"]
  };
}

describe("committeeSenderPlans", () => {

  it("plans one sender per on-domain committee mailbox and skips personal addresses", () => {
    const committee: CommitteeConfig = {
      contactUs: {},
      roles: [chair()],
      fileTypes: [],
      expenses: { costPerMile: 0.28 }
    };
    expect(committeeSenderPlans(committee, "group.example.org.uk")).toEqual([
      { email: "chair@group.example.org.uk", name: "Chair (Alex Reed)" },
      { email: "chairman@group.example.org.uk", name: "Chair (Alex Reed)" },
      { email: "alex.reed@group.example.org.uk", name: "Chair (Alex Reed)" }
    ]);
  });
});

describe("missingCommitteeSenders", () => {

  it("omits addresses already registered", () => {
    const plans = [
      { email: "chair@group.example.org.uk", name: "Chair (Alex Reed)" },
      { email: "secretary@group.example.org.uk", name: "Secretary (Jordan Blake)" }
    ];
    expect(missingCommitteeSenders(plans, ["Chair@group.example.org.uk"])).toEqual([
      { email: "secretary@group.example.org.uk", name: "Secretary (Jordan Blake)" }
    ]);
  });
});

describe("unregisteredCommitteeSenders", () => {

  it("skips vacant roles and roles that already have any on-domain sender", () => {
    const secretary: CommitteeMember = {
      description: "Secretary",
      email: "secretary@group.example.org.uk",
      fullName: "Jordan Blake",
      type: "secretary",
      roleType: RoleType.COMMITTEE_MEMBER,
      additionalEmails: ["jordan.blake@group.example.org.uk"]
    };
    const vacantWalks: CommitteeMember = {
      description: "Walks",
      email: "walks@group.example.org.uk",
      fullName: "",
      type: "walks",
      roleType: RoleType.COMMITTEE_MEMBER,
      vacant: true
    };
    const treasurer: CommitteeMember = {
      description: "Treasurer",
      email: "treasurer@group.example.org.uk",
      fullName: "Sam Patel",
      type: "treasurer",
      roleType: RoleType.COMMITTEE_MEMBER
    };
    const committee: CommitteeConfig = {
      contactUs: {},
      roles: [chair(), secretary, vacantWalks, treasurer],
      fileTypes: [],
      expenses: { costPerMile: 0.28 }
    };
    expect(unregisteredCommitteeSenders(committee, "group.example.org.uk", [
      "chair@group.example.org.uk",
      "secretary@group.example.org.uk"
    ])).toEqual([
      { email: "treasurer@group.example.org.uk", name: "Treasurer (Sam Patel)" }
    ]);
  });
});

describe("sendingDomainAuthenticated", () => {

  it("treats a subdomain as ready when the parent domain is authenticated", () => {
    expect(sendingDomainAuthenticated("group.example.org.uk", [
      { domainName: "example.org.uk", authenticated: true }
    ])).toBe(true);
  });

  it("is not ready when no covering domain is authenticated", () => {
    expect(sendingDomainAuthenticated("group.example.org.uk", [
      { domainName: "example.org.uk", authenticated: false }
    ])).toBe(false);
  });
});

describe("roleMailboxExtras", () => {

  it("keeps chair as an extra when the generated role address is chairman", () => {
    const role: CommitteeMember = {
      description: "Chair",
      email: "chairman@group.example.org.uk",
      fullName: "Alex Reed",
      type: "chairman",
      roleType: RoleType.COMMITTEE_MEMBER,
      additionalEmails: ["chair@group.example.org.uk"]
    };
    expect(roleMailboxExtras(role, "group.example.org.uk")).toEqual(["chair@group.example.org.uk"]);
  });
});
