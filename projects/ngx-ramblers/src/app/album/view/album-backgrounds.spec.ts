import { AlbumBackgroundsComponent } from "./album-backgrounds";
import { PageService } from "../../services/page.service";
import { PageComponent } from "../../page/page.component";

describe("album background title ownership", () => {
  function albumView(pageShell: PageComponent | null): AlbumBackgroundsComponent {
    const component = Object.create(AlbumBackgroundsComponent.prototype) as AlbumBackgroundsComponent;
    component["pageShell"] = pageShell;
    component["pageService"] = {setContentPageTitle: vi.fn()} as unknown as PageService;
    component["document"] = {defaultView: {matchMedia: () => ({matches: true})}} as unknown as Document;
    component.album = {showTitle: true, title: "Hillside Park album"} as unknown as typeof component.album;
    return component;
  }

  it("publishes the title only when a page shell will display it", () => {
    const owned = albumView({} as PageComponent);
    owned["publishMobilePageTitle"]();
    expect(owned.pageTitleOwned()).toBe(true);
    expect(owned["pageService"].setContentPageTitle).toHaveBeenCalledWith("Hillside Park album");
  });

  it("leaves the local title in place when there is no page shell", () => {
    const embedded = albumView(null);
    embedded["publishMobilePageTitle"]();
    expect(embedded.pageTitleOwned()).toBe(false);
    expect(embedded["pageService"].setContentPageTitle).not.toHaveBeenCalled();
  });
});
