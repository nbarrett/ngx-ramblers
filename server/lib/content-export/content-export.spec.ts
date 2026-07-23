import expect from "expect";
import { describe, it } from "mocha";
import { ContentExportFormat } from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import { contentExportFormatFromAccept } from "./content-export";

describe("content-export", () => {
  describe("contentExportFormatFromAccept", () => {
    it("selects markdown when explicitly accepted", () => {
      expect(contentExportFormatFromAccept("text/markdown")).toBe(ContentExportFormat.MARKDOWN);
    });

    it("selects JSON when explicitly accepted", () => {
      expect(contentExportFormatFromAccept("application/json")).toBe(ContentExportFormat.JSON);
    });

    it("honours media type quality", () => {
      expect(contentExportFormatFromAccept("text/markdown;q=0.5, application/json;q=0.9")).toBe(ContentExportFormat.JSON);
    });

    it("ignores disabled and unsupported media types", () => {
      expect(contentExportFormatFromAccept("text/markdown;q=0, text/html, */*")).toBe(null);
    });

    it("leaves ordinary browser HTML requests unchanged", () => {
      expect(contentExportFormatFromAccept("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(null);
    });
  });
});
