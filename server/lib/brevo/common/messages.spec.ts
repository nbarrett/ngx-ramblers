import expect from "expect";
import { describe, it } from "mocha";
import {
  applyTemplateOverrides,
  collapseBlankLines,
  collapseFroalaPlaceholderSpans,
  sanitiseBrevoTemplate,
  wrapMergeFieldsAsFroalaPlaceholders
} from "./messages";

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

    it("wraps merge fields concatenated with other text without spaces", () => {
      const input = `<a href="{{params.systemMergeFields.APP_URL}}/how-to">link</a>`;
      const output = wrapMergeFieldsAsFroalaPlaceholders(input);
      expect(output).toContain(
        `<span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">{{params.systemMergeFields.APP_URL}}</span>/how-to`
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

    it("replaces override markers with img tags when URL is provided", () => {
      const html = `<p>{{override.WALKS_PROGRAMME_IMAGE}}</p>`;
      const result = applyTemplateOverrides(html, {
        WALKS_PROGRAMME_IMAGE: "https://example.com/walks.png"
      });
      expect(result).toContain(`<img src="https://example.com/walks.png"`);
      expect(result).toContain(`alt="Walks Programme Image"`);
    });

    it("replaces override markers with placeholder text when URL is missing", () => {
      const html = `<p>{{override.HOME_PAGE_IMAGE}}</p>`;
      const result = applyTemplateOverrides(html, {});
      expect(result).toContain("[Home Page Image — To Be Added By Your Webmaster]");
      expect(result).not.toContain("{{override.");
    });

    it("handles multiple override keys in the same template", () => {
      const html = `<p>{{override.WALKS_PROGRAMME_IMAGE}}</p><p>{{override.HOME_PAGE_IMAGE}}</p>`;
      const result = applyTemplateOverrides(html, {
        WALKS_PROGRAMME_IMAGE: "https://example.com/walks.png",
        HOME_PAGE_IMAGE: "https://example.com/home.png"
      });
      expect(result).toContain(`src="https://example.com/walks.png"`);
      expect(result).toContain(`src="https://example.com/home.png"`);
    });

    it("returns HTML unchanged when no override markers exist", () => {
      const html = `<p>Hello world</p>`;
      expect(applyTemplateOverrides(html, {})).toBe(html);
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
});
