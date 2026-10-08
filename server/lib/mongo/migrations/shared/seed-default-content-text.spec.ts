import expect from "expect";
import { describe, it } from "mocha";
import { DEFAULT_CONTENT_ENTRIES } from "../../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";
import { EXPENSES_HOW_TO_DOCUMENTATION_URL } from "../../../../../projects/ngx-ramblers/src/app/models/walks-route-paths.model";

const REQUIRED_NAMES = [
  "expenses-detailed-help",
  "venue-settings-help",
  "bookings-configuration-help",
  "inbox-help",
  "image-editor-help",
  "meetup-help",
  "os-maps-help",
  "socialEventsInformation",
  "committee-expenses-help",
  "risk-assessments-heading"
];

describe("default content catalog", () => {
  it("includes every in-app help name that the seed migration applies", () => {
    const names = DEFAULT_CONTENT_ENTRIES.map(entry => entry.name);
    REQUIRED_NAMES.forEach(name => {
      expect(names.includes(name)).toBe(true);
    });
  });

  it("gives expenses help a documentation-host how-to link and no named group", () => {
    const expenses = DEFAULT_CONTENT_ENTRIES.find(entry => entry.name === "expenses-detailed-help");
    expect(expenses?.category).toBe("admin");
    expect(expenses?.text).toContain(EXPENSES_HOW_TO_DOCUMENTATION_URL);
    expect(expenses?.text).toContain("Add Expense Claim");
    expect(expenses?.text).toContain("Submit Claim");
    expect(expenses?.text).toContain("Payment created in Unity");
    expect(expenses?.text).toContain("Authorised in Unity");
    expect(/mailchi\.mp/i.test(expenses?.text || "")).toBe(false);
    expect(/ekwg|pang valley|mailchimp/i.test(expenses?.text || "")).toBe(false);
  });

  it("keeps social events intro generic", () => {
    const social = DEFAULT_CONTENT_ENTRIES.find(entry => entry.name === "socialEventsInformation");
    expect(/covid|ekwg|east kent/i.test(social?.text || "")).toBe(false);
    expect(social?.text).toContain("Contact Us");
  });

  it("gives every catalog entry a name, category and text", () => {
    DEFAULT_CONTENT_ENTRIES.forEach(entry => {
      expect(entry.name).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.text).toBeTruthy();
    });
  });
});
