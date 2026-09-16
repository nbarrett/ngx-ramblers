import expect from "expect";
import { describe, it } from "mocha";
import { SiteMigrationConfig } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { migrationTemplatePaths, templatePageForJob } from "./registration-import-scrape";

describe("registration import templates", () => {

  it("collects each template once from the site and its sections", () => {
    const migration = {
      templateFragmentId: "fragments/templates/self-service/text-with-images",
      parentPages: [
        {url: "https://group.example/", pathPrefix: "", templateFragmentId: "fragments/templates/self-service/contact"},
        {url: "https://group.example/walks", pathPrefix: "walks", templateFragmentId: "fragments/templates/self-service/text-with-images"},
        {url: "https://group.example/other", pathPrefix: "other"}
      ]
    } as SiteMigrationConfig;
    expect(migrationTemplatePaths(migration)).toEqual([
      "fragments/templates/self-service/text-with-images",
      "fragments/templates/self-service/contact"
    ]);
  });

  it("returns nothing when no templates are configured", () => {
    expect(migrationTemplatePaths({parentPages: []} as SiteMigrationConfig)).toEqual([]);
  });

  it("keeps the template's row mappings when sending it to the worker", () => {
    const template = {
      id: "stored-id",
      path: "fragments/templates/self-service/text-with-images",
      rows: [{type: "text", maxColumns: 1, showSwiper: false, columns: []}],
      migrationTemplate: {mappings: [{targetRowIndex: 0, sourceType: "content"}]}
    } as unknown as PageContent;
    expect(templatePageForJob(template)).toEqual({
      path: "fragments/templates/self-service/text-with-images",
      rows: template.rows,
      migrationTemplate: template.migrationTemplate
    });
  });
});
