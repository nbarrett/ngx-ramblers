import expect from "expect";
import { describe, it } from "mocha";
import { migrationSectionIndex, migrationSectionNodes } from "../../../projects/ngx-ramblers/src/app/functions/migration-section-tree";
import { ParentPageConfig } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";

describe("migrationSectionNodes", () => {
  const describeSection = (section: ParentPageConfig) => ({title: section.pathPrefix, detail: `from ${section.url}`});
  const section = (pathPrefix: string): ParentPageConfig => ({url: `https://group.example/${pathPrefix}`, pathPrefix} as ParentPageConfig);

  it("nests each section under the section it sits beneath on the new site", () => {
    const nodes = migrationSectionNodes([
      section("home"),
      section("information"),
      section("information/newsletter-archive"),
      section("information/newsletter-archive/newsletter-45"),
      section("photos"),
      section("photos/3-parks-walk")
    ], describeSection);
    expect(nodes.map(node => node.title)).toEqual(["home", "information", "photos"]);
    expect(nodes[1].children.map(node => node.title)).toEqual(["information/newsletter-archive"]);
    expect(nodes[1].children[0].children.map(node => node.title)).toEqual(["information/newsletter-archive/newsletter-45"]);
    expect(nodes[2].children.map(node => node.title)).toEqual(["photos/3-parks-walk"]);
    expect(nodes[0].detail).toEqual("from https://group.example/home");
    expect(nodes.map(node => node.key)).toEqual(["section-0-home", "section-1-information", "section-4-photos"]);
  });

  it("keeps a section a reviewer has just added, which has no address yet, as its own row", () => {
    const nodes = migrationSectionNodes([section("home"), {url: "", pathPrefix: ""} as ParentPageConfig], describeSection);
    expect(nodes.map(node => node.key)).toEqual(["section-0-home", "section-1-new"]);
    expect(migrationSectionIndex(nodes[1].key)).toEqual(1);
  });

  it("keeps a section whose parent section is missing at the top, so nothing is hidden", () => {
    const nodes = migrationSectionNodes([section("walks/leading-a-walk"), section("about-us")], describeSection);
    expect(nodes.map(node => node.title)).toEqual(["walks/leading-a-walk", "about-us"]);
  });
});
