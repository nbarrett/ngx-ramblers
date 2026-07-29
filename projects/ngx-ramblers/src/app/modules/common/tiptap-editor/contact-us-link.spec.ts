import {
  buildContactUsHref,
  contactUsRoleOptionLabel,
  defaultContactUsLabel,
  isContactUsHref,
  parseContactUsHref
} from "./contact-us-link";
import { CommitteeMember, RoleType } from "../../../models/committee.model";

describe("contact-us-link", () => {

  it("builds contact-us href with role and redirect", () => {
    expect(buildContactUsHref("treasurer", "contact-us")).toBe(
      "?contact-us&role=treasurer&redirect=contact-us"
    );
    expect(buildContactUsHref("walks-co-ordinator", "/walks/admin")).toBe(
      "?contact-us&role=walks-co-ordinator&redirect=walks/admin"
    );
  });

  it("omits the redirect when the link is created on the root page", () => {
    expect(buildContactUsHref("support", "")).toBe("?contact-us&role=support");
    expect(buildContactUsHref("support", null)).toBe("?contact-us&role=support");
    expect(buildContactUsHref("support", "home")).toBe("?contact-us&role=support");
    expect(buildContactUsHref("support", "/home")).toBe("?contact-us&role=support");
  });

  it("parses contact-us hrefs", () => {
    expect(parseContactUsHref("?contact-us&role=treasurer&redirect=contact-us")).toEqual({
      role: "treasurer",
      redirect: "contact-us"
    });
    expect(parseContactUsHref("https://www.ekwg.co.uk/?contact-us&role=chairman&redirect=home")).toEqual({
      role: "chairman",
      redirect: "home"
    });
    expect(parseContactUsHref("/walks")).toBeNull();
    expect(parseContactUsHref("")).toBeNull();
  });

  it("detects contact-us hrefs", () => {
    expect(isContactUsHref("?contact-us&role=x&redirect=y")).toBe(true);
    expect(isContactUsHref("https://example.com/page")).toBe(false);
  });

  it("defaults contact label from member name", () => {
    const member: CommitteeMember = {
      type: "treasurer",
      fullName: "Jon Smith",
      description: "Treasurer",
      email: "jon@example.com",
      roleType: RoleType.COMMITTEE_MEMBER
    };
    expect(defaultContactUsLabel(member, fullName => fullName.split(" ")[0] || null)).toBe("Contact Jon");
    expect(defaultContactUsLabel(null, () => null)).toBe("Contact us");
  });

  it("formats role option labels", () => {
    const member: CommitteeMember = {
      type: "treasurer",
      fullName: "Jon Smith",
      description: "Treasurer",
      email: "jon@example.com",
      roleType: RoleType.COMMITTEE_MEMBER
    };
    expect(contactUsRoleOptionLabel(member)).toBe("Treasurer (Jon Smith)");
  });
});
