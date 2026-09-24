import { describe, expect, it } from "vitest";
import { CommitteeConfig, CommitteeMember, RoleType } from "../models/committee.model";
import {
  committeeMailRewriteCount,
  mailDomainForSiteHost,
  ngxRamblersMailDomain,
  replaceEmailDomain,
  rewriteCommitteeMailAddresses
} from "./rewrite-mail-domain";

function role(email: string): CommitteeMember {
  return {
    description: "Chair",
    email,
    fullName: "Justin Lumley",
    type: "chairman",
    roleType: RoleType.COMMITTEE_MEMBER
  };
}

describe("replaceEmailDomain", () => {

  it("rewrites only addresses on the old domain, and never uses www", () => {
    expect(replaceEmailDomain("chairman@finchley-hornsey.ngx-ramblers.org.uk", "finchley-hornsey.ngx-ramblers.org.uk", "www.fhramblers.org.uk"))
      .toEqual("chairman@fhramblers.org.uk");
    expect(replaceEmailDomain("julia@gmail.com", "finchley-hornsey.ngx-ramblers.org.uk", "fhramblers.org.uk"))
      .toEqual("julia@gmail.com");
  });

});

describe("rewriteCommitteeMailAddresses", () => {

  it("rewrites role mailboxes and extra addresses on the old domain", () => {
    const before: CommitteeConfig = {
      contactUs: {},
      roles: [
        {
          ...role("chairman@old.example"),
          additionalEmails: ["justin.lumley@old.example"],
          inboxNotificationEmail: "justin.lumley@old.example"
        }
      ],
      fileTypes: [],
      expenses: {costPerMile: 0.28}
    };
    const after = rewriteCommitteeMailAddresses(before, "old.example", "new.example");
    expect(after.roles[0].email).toEqual("chairman@new.example");
    expect(after.roles[0].additionalEmails).toEqual(["justin.lumley@new.example"]);
    expect(committeeMailRewriteCount(before, after)).toEqual(1);
  });

  it("repairs a mailbox that was stored with https:// in the domain", () => {
    const before: CommitteeConfig = {
      contactUs: {},
      roles: [role("chairman@https://fhramblers.org.uk")],
      fileTypes: [],
      expenses: {costPerMile: 0.28}
    };
    const after = rewriteCommitteeMailAddresses(before, "https://fhramblers.org.uk", "fhramblers.org.uk");
    expect(after.roles[0].email).toEqual("chairman@fhramblers.org.uk");
  });

});

describe("mail domain helpers", () => {

  it("names the ngx-ramblers mailbox domain from the environment", () => {
    expect(ngxRamblersMailDomain("finchley-hornsey")).toEqual("finchley-hornsey.ngx-ramblers.org.uk");
    expect(mailDomainForSiteHost("www.fhramblers.org.uk")).toEqual("fhramblers.org.uk");
    expect(mailDomainForSiteHost("https://fhramblers.org.uk")).toEqual("fhramblers.org.uk");
  });

});
