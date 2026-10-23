import { AlbumBackgroundsComponent } from "./album-backgrounds";
import { PageService } from "../../services/page.service";
import { PageComponent } from "../../page/page.component";

describe("album background title ownership", () => {
  function albumView(pageShell: PageComponent | null, mobile = true, initialTitle: string | null = null): AlbumBackgroundsComponent {
    const component = Object.create(AlbumBackgroundsComponent.prototype) as AlbumBackgroundsComponent;
    const state = {title: initialTitle};
    component["pageShell"] = pageShell;
    component["pageService"] = {
      contentPageTitle: () => state.title,
      setContentPageTitle: vi.fn(title => state.title = title)
    } as unknown as PageService;
    component["document"] = {defaultView: {matchMedia: () => ({matches: mobile})}} as unknown as Document;
    component["subscriptions"] = [];
    component.album = {showTitle: true, title: "Hillside Park album"} as unknown as typeof component.album;
    return component;
  }

  it("publishes the title when a page shell will display it", () => {
    const owned = albumView({showTitle: true} as PageComponent);
    owned["publishMobilePageTitle"]();
    expect(owned.pageTitleOwned()).toBe(true);
    expect(owned["pageService"].contentPageTitle()).toBe("Hillside Park album");
  });

  it("leaves the local title in place when there is no page shell", () => {
    const embedded = albumView(null);
    embedded["publishMobilePageTitle"]();
    expect(embedded.pageTitleOwned()).toBe(false);
    expect(embedded["pageService"].setContentPageTitle).not.toHaveBeenCalled();
  });

  it.each([true, false])("preserves an existing CMS title on mobile=%s and destruction", mobile => {
    const component = albumView({showTitle: true} as PageComponent, mobile, "Woodland Trail");
    component["publishMobilePageTitle"]();
    expect(component.pageTitleOwned()).toBe(false);
    component.ngOnDestroy();
    expect(component["pageService"].contentPageTitle()).toBe("Woodland Trail");
    expect(component["pageService"].setContentPageTitle).not.toHaveBeenCalled();
  });

  it.each([{showTitle: false}, {showTitle: true, pageTitle: "Walk photos"}])("keeps the album title local when the page shell has its own heading configuration: %s", shell => {
    const component = albumView(shell as PageComponent);
    component["publishMobilePageTitle"]();
    expect(component.pageTitleOwned()).toBe(false);
    expect(component["pageService"].setContentPageTitle).not.toHaveBeenCalled();
  });

  it("releases its mobile title when resized to desktop", () => {
    const component = albumView({showTitle: true} as PageComponent);
    component["publishMobilePageTitle"]();
    component["document"].defaultView.matchMedia = () => ({matches: false}) as MediaQueryList;
    component.onWindowResize();
    expect(component.pageTitleOwned()).toBe(false);
    expect(component["pageService"].contentPageTitle()).toBeNull();
  });

  it("clears its own title on destruction", () => {
    const component = albumView({showTitle: true} as PageComponent);
    component["publishMobilePageTitle"]();
    component.ngOnDestroy();
    expect(component["pageService"].contentPageTitle()).toBeNull();
  });

  it("preserves a title set by another component after publishing its own", () => {
    const component = albumView({showTitle: true} as PageComponent);
    component["publishMobilePageTitle"]();
    component["pageService"].setContentPageTitle("Woodland Trail");
    component.ngOnDestroy();
    expect(component["pageService"].contentPageTitle()).toBe("Woodland Trail");
  });
});
