import { describe, expect, it } from "vitest";
import { CommitteeConfig, CommitteeMember, RoleType } from "../models/committee.model";
import { committeeSenderPlans, missingCommitteeSenders } from "./committee-senders";

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
