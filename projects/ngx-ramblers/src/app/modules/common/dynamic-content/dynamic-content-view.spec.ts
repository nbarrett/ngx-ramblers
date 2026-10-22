import { PageContentType } from "../../../models/content-text.model";
import { AccessLevel } from "../../../models/member-resource.model";
import { liteHomePageContent } from "../../../models/home-content.model";
import { DynamicContentViewComponent } from "./dynamic-content-view";

describe("dynamic content title lifting", () => {
  function view(liftPageTitle: boolean): DynamicContentViewComponent {
    const component = Object.create(DynamicContentViewComponent.prototype) as DynamicContentViewComponent;
    component.liftPageTitle = liftPageTitle;
    component["pageService"] = {setContentPageTitle: vi.fn()} as unknown as typeof component["pageService"];
    component.actions = {isTextRow: row => row?.type === PageContentType.TEXT} as unknown as typeof component.actions;
    component["logger"] = {info: vi.fn()} as unknown as typeof component["logger"];
    component["loadSharedFragments"] = vi.fn();
    component.pageContentFilteredForAccessLevel = pageContent => pageContent;
    return component;
  }

  it("keeps the lite homepage heading in the content when lifting is off", () => {
    const component = view(false);
    const pageContent = liteHomePageContent("Hillside Park");
    component["filterAndSet"](pageContent);
    expect(component.viewablePageContent.rows[0].columns[0].contentText).toBe("# Welcome to Hillside Park");
    expect(component["pageService"].setContentPageTitle).not.toHaveBeenCalled();
  });

  it("lifts a CMS page heading into the page shell and removes the duplicate row", () => {
    const component = view(true);
    component["filterAndSet"]({
      path: "walks/woodland-trail",
      rows: [
        {
          type: PageContentType.TEXT,
          showSwiper: false,
          maxColumns: 1,
          columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: "# Woodland Trail\n"}]
        },
        {
          type: PageContentType.TEXT,
          showSwiper: false,
          maxColumns: 1,
          columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: "A circular walk."}]
        }
      ]
    });
    expect(component["pageService"].setContentPageTitle).toHaveBeenCalledWith("Woodland Trail");
    expect(component.viewablePageContent.rows).toHaveLength(1);
    expect(component.viewablePageContent.rows[0].columns[0].contentText).toBe("A circular walk.");
  });
});
