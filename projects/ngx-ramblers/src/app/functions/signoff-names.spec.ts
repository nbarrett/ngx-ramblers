import { signoffNamesHtml } from "./signoff-names";
import { CommitteeMember, RoleType } from "../models/committee.model";

describe("signoffNamesHtml", () => {
  const chair: CommitteeMember = {
    type: "chair",
    fullName: "Alex Reed",
    email: "chair@group.example.org.uk",
    description: "Chair",
    roleType: RoleType.COMMITTEE_MEMBER
  };

  it("renders a list of named roles with mailto links", () => {
    const html = signoffNamesHtml([chair], ["chair"], "https://group.example.org.uk");
    expect(html).toContain("Alex Reed");
    expect(html).toContain("mailto:chair@group.example.org.uk");
    expect(html).toContain("<ul>");
  });

  it("returns empty when no matching roles are given", () => {
    expect(signoffNamesHtml([chair], ["secretary"], "https://group.example.org.uk")).toBe("");
  });
});
