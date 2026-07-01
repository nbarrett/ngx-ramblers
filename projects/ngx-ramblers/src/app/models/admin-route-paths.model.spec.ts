import { AdminContentPath, AdminPath, adminParentPath, adminRelativePath } from "./admin-route-paths.model";

describe("admin-route-paths", () => {

  describe("adminRelativePath", () => {

    it("maps the admin landing page to the lazy route root", () => {
      expect(adminRelativePath(AdminPath.ADMIN)).toEqual("");
    });

    it("removes the admin prefix from nested admin routes", () => {
      expect(adminRelativePath(AdminContentPath.PAGE_CONTENT_NAVIGATOR)).toEqual("content/page-content-navigator");
    });

  });

  describe("adminParentPath", () => {

    it("returns the category landing path for a categorised admin child route", () => {
      expect(adminParentPath("admin/content/page-content-navigator")).toEqual(AdminContentPath.ROOT);
    });

    it("returns admin for top-level admin child routes", () => {
      expect(adminParentPath("admin/mail-settings")).toEqual(AdminPath.ADMIN);
    });

  });

});
