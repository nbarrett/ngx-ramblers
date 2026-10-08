import expect from "expect";
import { describe, it } from "mocha";
import { PageContentType } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { pageContent } from "./page-content";

describe("page content schema", () => {
  it("keeps row accessLevel on save", () => {
    const document = new pageContent({
      path: "contact-us",
      rows: [{
        type: PageContentType.TEXT,
        maxColumns: 1,
        showSwiper: false,
        accessLevel: AccessLevel.HIDDEN,
        columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: "Contact Us"}]
      }]
    }).toObject();
    expect(document.rows[0].accessLevel).toEqual(AccessLevel.HIDDEN);
    expect(document.rows[0].columns[0].accessLevel).toEqual(AccessLevel.PUBLIC);
  });

  it("defines accessLevel on both rows and columns", () => {
    const rowSchema = (pageContent.schema.path("rows") as any).schema;
    const columnSchema = rowSchema.path("columns").schema;
    expect(rowSchema.path("accessLevel")).toBeTruthy();
    expect(columnSchema.path("accessLevel")).toBeTruthy();
  });
});
