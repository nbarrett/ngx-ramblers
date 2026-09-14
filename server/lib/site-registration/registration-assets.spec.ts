import expect from "expect";
import {describe, it} from "mocha";
import {PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {RegistrationNavbarPath, RegistrationPageType, StoredSiteRegistration} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import {rewriteRegistrationPageLinks} from "./registration-assets";

describe("registration assets", () => {
  it("rewrites links between migrated pages while retaining anchors", () => {
    const registration = {
      website: "https://group.example/",
      pages: [
        {url: "https://group.example/", path: RegistrationNavbarPath.HOME, title: "Home", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false},
        {url: "https://group.example/about", path: "about", title: "About", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false}
      ],
      proposedNavigation: [{path: RegistrationNavbarPath.HOME, title: "Home"}, {path: "about", title: "About"}]
    } as StoredSiteRegistration;
    const pages = [{path: RegistrationNavbarPath.HOME, rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Read [about us](/about#history)."}]}]}];
    const rewritten = rewriteRegistrationPageLinks(registration, pages);
    expect(rewritten[0].rows[0].columns[0].contentText).toBe("Read [about us](/about-us#history).");
  });

  it("rewrites a source document link to its migrated destination", () => {
    const registration = {website: "https://group.example/", pages: [], proposedNavigation: []} as StoredSiteRegistration;
    const pages = [{path: RegistrationNavbarPath.HOME, rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Read [minutes](/files/minutes.pdf)."}]}]}];
    const rewritten = rewriteRegistrationPageLinks(registration, pages, new Map([["https://group.example/files/minutes.pdf", "/home/minutes"]]));
    expect(rewritten[0].rows[0].columns[0].contentText).toBe("Read [minutes](/home/minutes).");
  });
});
