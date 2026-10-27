import expect from "expect";
import { describe, it } from "mocha";
import { allowedFromAddresses, roleMatchingFrom } from "./mail-client-auth";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

describe("mail client from addresses", () => {
  const webmaster: CommitteeMember = {
    type: "webmaster",
    description: "Webmaster",
    fullName: "Alex Reed",
    email: "webmaster@group.example.org.uk",
    additionalEmails: ["web@group.example.org.uk"],
    vacant: false
  } as CommitteeMember;
  const secretary: CommitteeMember = {
    type: "secretary",
    description: "Secretary",
    fullName: "Jamie Cole",
    email: "secretary@group.example.org.uk",
    vacant: false
  } as CommitteeMember;

  it("accepts the primary and extra role addresses", () => {
    const allowed = allowedFromAddresses([webmaster]);
    expect(allowed).toContain("webmaster@group.example.org.uk");
    expect(allowed).toContain("web@group.example.org.uk");
    expect(roleMatchingFrom([webmaster, secretary], "WEB@group.example.org.uk")?.type).toEqual("webmaster");
  });

  it("refuses an address on a role the member does not hold", () => {
    expect(roleMatchingFrom([webmaster], "secretary@group.example.org.uk")).toEqual(null);
  });
});
