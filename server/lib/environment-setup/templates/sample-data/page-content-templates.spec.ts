import expect from "expect";
import {describe, it} from "mocha";
import {
  createPrivacyPolicyPage,
  PRIVACY_POLICY_PATH,
  privacyPolicyMarkdown,
  WALKING_APP_HOWTO_PATH,
  WALKING_APP_HOWTO_URL
} from "./page-content-templates";

describe("privacy policy seed", () => {
  const markdown = privacyPolicyMarkdown({groupName: "Hillside Park", groupShortName: "hillside-park"});

  it("covers the walking app and optional analytics", () => {
    expect(markdown).toContain("Hillside Park");
    expect(markdown).toContain("## Walking app");
    expect(markdown).toContain("## Optional website analytics");
    expect(markdown).toContain("Analytics is optional");
    expect(markdown).toContain(WALKING_APP_HOWTO_URL);
    expect(markdown.includes("What We Do NOT Use")).toBe(false);
    expect(markdown.includes("Online Privacy Policy Only")).toBe(false);
    expect(markdown.includes("No personal data, analytics identifiers")).toBe(false);
    expect(markdown.includes("hereby consent")).toBe(false);
  });

  it("creates the page at the footer path", () => {
    const page = createPrivacyPolicyPage({groupName: "Hillside Park", groupShortName: "hillside-park"});
    expect(page.path).toBe(PRIVACY_POLICY_PATH);
    expect(WALKING_APP_HOWTO_PATH).toBe("how-to/walking-app");
    expect(page.rows?.[0]?.columns?.[0]?.contentText).toBe(markdown);
  });
});
