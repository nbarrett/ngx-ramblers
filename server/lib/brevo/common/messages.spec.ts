import expect from "expect";
import { describe, it } from "mocha";
import {
  applyContentBlocks,
  applyTemplateOverrides,
  collapseBlankLines,
  collapseFroalaPlaceholderSpans,
  escapeUnknownTemplateExpressions,
  extractContentBlockKeys,
  renderBrandedTemplate,
  renderLocalBrandedTemplate,
  sanitiseBrevoTemplate,
  wrapMergeFieldsAsFroalaPlaceholders
} from "./messages";
import {
  TemplateOverride,
  TemplateOverrides,
  TemplateOverrideState,
  TemplateOverrideType
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

function imageOverride(imageUrl: string): TemplateOverride {
  return {type: TemplateOverrideType.IMAGE, state: TemplateOverrideState.CUSTOM, imageUrl};
}

function contentOverride(content: string): TemplateOverride {
  return {type: TemplateOverrideType.CONTENT, state: TemplateOverrideState.CUSTOM, content};
}

function omittedOverride(type: TemplateOverrideType): TemplateOverride {
  return {type, state: TemplateOverrideState.OMITTED};
}

describe("brevo messages", () => {

  describe("wrapMergeFieldsAsFroalaPlaceholders", () => {

    it("wraps a standalone merge field in a Froala placeholder span", () => {
      const input = "Welcome to {{params.systemMergeFields.APP_LONGNAME}}!";
      const output = wrapMergeFieldsAsFroalaPlaceholders(input);
      expect(output).toBe(
        `Welcome to <span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">{{params.systemMergeFields.APP_LONGNAME}}</span>!`
      );
    });

    it("wraps multiple merge fields in the same string", () => {
      const input = "Hi {{params.memberMergeFields.FNAME}}, welcome to {{params.systemMergeFields.APP_SHORTNAME}}.";
      const output = wrapMergeFieldsAsFroalaPlaceholders(input);
      expect(output).toContain(
        `<span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">{{params.memberMergeFields.FNAME}}</span>`
      );
      expect(output).toContain(
        `<span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">{{params.systemMergeFields.APP_SHORTNAME}}</span>`
      );
    });

    it("wraps merge fields concatenated with other text without spaces in text content", () => {
      const input = `<p>Visit {{params.systemMergeFields.APP_URL}}/how-to for help</p>`;
      const output = wrapMergeFieldsAsFroalaPlaceholders(input);
      expect(output).toContain(
        `<span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">{{params.systemMergeFields.APP_URL}}</span>/how-to`
      );
    });

    it("does NOT wrap merge fields inside HTML attribute values", () => {
      const input = `<a href="{{params.systemMergeFields.APP_URL}}/how-to">link</a>`;
      const output = wrapMergeFieldsAsFroalaPlaceholders(input);
      expect(output).toBe(input);
      expect(output).not.toContain(`placeholder rte-personalized-node`);
    });

    it("does NOT wrap merge fields inside src or href attributes", () => {
      const input = `<img src="{{params.messageMergeFields.BANNER_IMAGE_SOURCE}}" alt="logo">`;
      const output = wrapMergeFieldsAsFroalaPlaceholders(input);
      expect(output).toBe(input);
    });

    it("wraps merge fields in text content while leaving attributes untouched in the same element", () => {
      const input = `<a href="{{params.systemMergeFields.APP_URL}}">Go to {{params.systemMergeFields.APP_SHORTNAME}}</a>`;
      const output = wrapMergeFieldsAsFroalaPlaceholders(input);
      expect(output).toContain(`href="{{params.systemMergeFields.APP_URL}}"`);
      expect(output).toContain(
        `<span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">{{params.systemMergeFields.APP_SHORTNAME}}</span></a>`
      );
    });

    it("leaves text without merge fields unchanged", () => {
      const input = "<p>Just some plain text</p>";
      expect(wrapMergeFieldsAsFroalaPlaceholders(input)).toBe(input);
    });

    it("is a reversible transform with collapseFroalaPlaceholderSpans", () => {
      const input = "Welcome to {{params.systemMergeFields.APP_LONGNAME}}, dear {{params.memberMergeFields.FNAME}}!";
      const wrapped = wrapMergeFieldsAsFroalaPlaceholders(input);
      const unwrapped = collapseFroalaPlaceholderSpans(wrapped);
      expect(unwrapped).toBe(input);
    });
  });

  describe("collapseFroalaPlaceholderSpans", () => {

    it("strips Froala placeholder spans and preserves inner text", () => {
      const input = `<span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">{{params.systemMergeFields.APP_LONGNAME}}</span>`;
      expect(collapseFroalaPlaceholderSpans(input)).toBe("{{params.systemMergeFields.APP_LONGNAME}}");
    });
  });

  describe("applyTemplateOverrides", () => {

    it("replaces override markers with img tags when a custom image is provided", () => {
      const html = `<p>{{override.WALKS_PROGRAMME_IMAGE}}</p>`;
      const result = applyTemplateOverrides(html, {
        WALKS_PROGRAMME_IMAGE: imageOverride("https://example.com/walks.png")
      });
      expect(result).toContain(`<img src="https://example.com/walks.png"`);
      expect(result).toContain(`alt="Walks Programme Image"`);
    });

    it("replaces override markers with placeholder text when no override exists", () => {
      const html = `<p>{{override.HOME_PAGE_IMAGE}}</p>`;
      const result = applyTemplateOverrides(html, {});
      expect(result).toContain("[Home Page Image — To Be Added By Your Webmaster]");
      expect(result).not.toContain("{{override.");
    });

    it("renders nothing for an omitted image override", () => {
      const html = `<p>before</p>{{override.HOME_PAGE_IMAGE}}<p>after</p>`;
      const result = applyTemplateOverrides(html, {
        HOME_PAGE_IMAGE: omittedOverride(TemplateOverrideType.IMAGE)
      });
      expect(result).toBe(`<p>before</p><p>after</p>`);
    });

    it("handles multiple override keys in the same template", () => {
      const html = `<p>{{override.WALKS_PROGRAMME_IMAGE}}</p><p>{{override.HOME_PAGE_IMAGE}}</p>`;
      const result = applyTemplateOverrides(html, {
        WALKS_PROGRAMME_IMAGE: imageOverride("https://example.com/walks.png"),
        HOME_PAGE_IMAGE: imageOverride("https://example.com/home.png")
      });
      expect(result).toContain(`src="https://example.com/walks.png"`);
      expect(result).toContain(`src="https://example.com/home.png"`);
    });

    it("treats a legacy plain-string override as a custom image", () => {
      const html = `<p>{{override.HOME_PAGE_IMAGE}}</p>`;
      const legacyOverrides = {HOME_PAGE_IMAGE: "https://example.com/legacy.png"} as unknown as TemplateOverrides;
      const result = applyTemplateOverrides(html, legacyOverrides);
      expect(result).toContain(`<img src="https://example.com/legacy.png"`);
    });

    it("returns HTML unchanged when no override markers exist", () => {
      const html = `<p>Hello world</p>`;
      expect(applyTemplateOverrides(html, {})).toBe(html);
    });
  });

  describe("content blocks", () => {

    const blockTemplate = `<p>intro</p>{% block SOCIAL_SECTION %}<h4>Social Events</h4><p>default prose</p>{% endblock %}<p>outro</p>`;

    it("extracts content block keys", () => {
      expect(extractContentBlockKeys(blockTemplate)).toEqual(["SOCIAL_SECTION"]);
      expect(extractContentBlockKeys("<p>no blocks</p>")).toEqual([]);
    });

    it("renders the repo default when no override exists", () => {
      const result = applyContentBlocks(blockTemplate, {});
      expect(result).toBe(`<p>intro</p><h4>Social Events</h4><p>default prose</p><p>outro</p>`);
    });

    it("renders custom markdown content as HTML when the block is overridden", () => {
      const result = applyContentBlocks(blockTemplate, {
        SOCIAL_SECTION: contentOverride("our **shorter** wording")
      });
      expect(result).toContain("<p>intro</p>");
      expect(result).toContain("<p>outro</p>");
      expect(result).toContain("our <strong>shorter</strong> wording");
      expect(result).not.toContain("Social Events");
    });

    it("renders nothing when the block is omitted", () => {
      const result = applyContentBlocks(blockTemplate, {
        SOCIAL_SECTION: omittedOverride(TemplateOverrideType.CONTENT)
      });
      expect(result).toBe(`<p>intro</p><p>outro</p>`);
    });

    it("renders the default when the override state is default", () => {
      const result = applyContentBlocks(blockTemplate, {
        SOCIAL_SECTION: {type: TemplateOverrideType.CONTENT, state: TemplateOverrideState.DEFAULT}
      });
      expect(result).toBe(`<p>intro</p><h4>Social Events</h4><p>default prose</p><p>outro</p>`);
    });
  });

  describe("collapseBlankLines", () => {

    it("collapses multiple blank lines after the body tag", () => {
      const input = `<body aria-disabled="false">\n\n\n\n<div>content</div>`;
      const result = collapseBlankLines(input);
      expect(result).toBe(`<body aria-disabled="false">\n<div>content</div>`);
    });

    it("leaves single newlines after body unchanged", () => {
      const input = `<body>\n<div>content</div>`;
      expect(collapseBlankLines(input)).toBe(input);
    });
  });

  describe("sanitiseBrevoTemplate", () => {

    it("strips Froala artefacts and normalises merge field placeholders", () => {
      const input = `<span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">{{ params.systemMergeFields.APP_URL }}</span>`;
      const result = sanitiseBrevoTemplate(input);
      expect(result).toBe("{{params.systemMergeFields.APP_URL}}");
    });
  });

  describe("renderBrandedTemplate", () => {

    const paramsFor = (passwordResetLink: string) => ({
      messageMergeFields: {
        subject: "Reset your password",
        BANNER_IMAGE_SOURCE: "",
        ADDRESS_LINE: "Hi Jane,",
        BODY_CONTENT_TOP: "",
        BODY_CONTENT_BOTTOM: "",
        ACCENT_COLOR: "#F9B104"
      },
      memberMergeFields: {
        FULL_NAME: "Jane Doe", EMAIL: "jane@example.com", FNAME: "Jane", LNAME: "Doe",
        MEMBER_NUM: "", MEMBER_EXP: "", USERNAME: "jane", PW_RESET: "abc-def-123"
      },
      systemMergeFields: {
        APP_SHORTNAME: "EKWG", APP_LONGNAME: "East Kent Walking Group", APP_URL: "https://example.org.uk",
        PW_RESET_LINK: passwordResetLink,
        FACEBOOK_URL: "", TWITTER_URL: "", INSTAGRAM_URL: ""
      },
      accountMergeFields: { STREET: "", POSTCODE: "", TOWN: "" }
    });

    it("substitutes PW_RESET_LINK inside an <a href> attribute", () => {
      const template = `<p>To reset your password, click <a href="{{params.systemMergeFields.PW_RESET_LINK}}" target="_blank">Reset Your Password</a>.</p>`;
      const passwordResetLink = "https://example.org.uk/admin/set-password/abc-def-123";
      const result = renderBrandedTemplate(template, paramsFor(passwordResetLink));
      expect(result).toContain(`href="${passwordResetLink}"`);
      expect(result).not.toContain("{{params.systemMergeFields.PW_RESET_LINK}}");
    });

    it("substitutes the merge field even when surrounding the Froala-wrapped variant from the Brevo editor", () => {
      const template = `<p>Click <a href="{{ params.systemMergeFields.PW_RESET_LINK }}">Reset</a>.</p>`;
      const passwordResetLink = "https://example.org.uk/admin/set-password/abc-def-123";
      const result = renderBrandedTemplate(template, paramsFor(passwordResetLink));
      expect(result).toContain(`href="${passwordResetLink}"`);
    });
  });

  describe("escapeUnknownTemplateExpressions", () => {
    it("escapes a malformed placeholder so Brevo treats it as literal text", () => {
      expect(escapeUnknownTemplateExpressions("a {{...}} b")).toEqual("a &#123;&#123;...&#125;&#125; b");
    });
    it("escapes a non-variable expression such as inline JSON", () => {
      expect(escapeUnknownTemplateExpressions(`{{ "key": [] }}`)).toEqual(`&#123;&#123; "key": [] &#125;&#125;`);
    });
    it("preserves valid Brevo contact tokens and merge-field paths", () => {
      const valid = `{{contact.FIRSTNAME}} {{ contact.LASTNAME }} {{params.systemMergeFields.APP_URL}} {{override.HOME_PAGE_IMAGE}}`;
      expect(escapeUnknownTemplateExpressions(valid)).toEqual(valid);
    });
    it("escapes only the malformed token in mixed content", () => {
      expect(escapeUnknownTemplateExpressions("Hi {{contact.FNAME}}, see {{...}}"))
        .toEqual("Hi {{contact.FNAME}}, see &#123;&#123;...&#125;&#125;");
    });
  });

  describe("renderLocalBrandedTemplate", () => {

    const paramsWith = (passwordResetLink: string, bodyContent = "") => ({
      messageMergeFields: {
        subject: "Test subject",
        BANNER_IMAGE_SOURCE: "",
        ADDRESS_LINE: "Hi Jane,",
        BODY_CONTENT: bodyContent,
        BODY_CONTENT_TOP: "",
        BODY_CONTENT_BOTTOM: "",
        ACCENT_COLOR: "#F9B104"
      },
      memberMergeFields: {
        FULL_NAME: "Jane Doe", EMAIL: "jane@example.com", FNAME: "Jane", LNAME: "Doe",
        MEMBER_NUM: "", MEMBER_EXP: "", USERNAME: "jane", PW_RESET: "abc-def-123"
      },
      systemMergeFields: {
        APP_SHORTNAME: "EKWG", APP_LONGNAME: "East Kent Walking Group", APP_URL: "https://example.org.uk",
        PW_RESET_LINK: passwordResetLink,
        FACEBOOK_URL: "", TWITTER_URL: "", INSTAGRAM_URL: ""
      },
      accountMergeFields: { STREET: "", POSTCODE: "", TOWN: "" }
    });

    it("renders welcome-to-the-group from the repo file with PW_RESET_LINK resolved and not mangled", () => {
      const passwordResetLink = "https://example.org.uk/admin/set-password/abc-def-123";
      const result = renderLocalBrandedTemplate("welcome-to-the-group", paramsWith(passwordResetLink));
      expect(result).toContain(passwordResetLink);
      expect(result).not.toContain("{{params.systemMergeFields.PW_RESET_LINK}}");
      expect(result).not.toContain("%7B%7B");
    });

    it("renders website-and-login-details from the repo file with PW_RESET_LINK resolved and not mangled", () => {
      const passwordResetLink = "https://example.org.uk/admin/set-password/abc-def-123";
      const result = renderLocalBrandedTemplate("website-and-login-details", paramsWith(passwordResetLink));
      expect(result).toContain(passwordResetLink);
      expect(result).not.toContain("{{params.systemMergeFields.PW_RESET_LINK}}");
      expect(result).not.toContain("%7B%7B");
    });

    it("renders the externally supplied body for fully-automated-text-body (the booking shell)", () => {
      const bodyContent = "<p>Your booking for the Wye Downs walk is confirmed.</p>";
      const result = renderLocalBrandedTemplate("fully-automated-text-body", paramsWith("", bodyContent));
      expect(result).toContain("Your booking for the Wye Downs walk is confirmed.");
      expect(result).not.toContain("{{params.messageMergeFields.BODY_CONTENT}}");
    });

    it("throws when the template name has no repo file", () => {
      expect(() => renderLocalBrandedTemplate("template-that-does-not-exist", paramsWith(""))).toThrow();
    });
  });
});
