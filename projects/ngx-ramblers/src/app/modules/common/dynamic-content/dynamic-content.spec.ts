import { TestBed } from "@angular/core/testing";
import { NavigationEnd, Router } from "@angular/router";
import { Subject } from "rxjs";
import { LoggerTestingModule } from "ngx-logger/testing";
import { vi } from "vitest";
import { DynamicContentComponent } from "./dynamic-content";
import { AuthService } from "../../../auth/auth.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { UrlService } from "../../../services/url.service";
import { StoredValue } from "../../../models/ui-actions";

describe("CMS content navigation", () => {
  const navigation = new Subject<NavigationEnd>();
  const authentication = new Subject();
  const state = {path: "walks/photos/hillside-park"};
  const findByPath = vi.fn();
  const components: DynamicContentComponent[] = [];
  const notice = {hide: vi.fn(), warning: vi.fn(), error: vi.fn()};

  beforeEach(() => {
    state.path = "walks/photos/hillside-park";
    findByPath.mockReset().mockImplementation(async path => ({path, rows: []}));
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        {provide: Router, useValue: {events: navigation}},
        {provide: AuthService, useValue: {authResponse: () => authentication}},
        {provide: MemberLoginService, useValue: {allowContentEdits: () => true}},
        {provide: NotifierService, useValue: {createAlertInstance: () => notice}},
        {provide: PageContentService, useValue: {findByPath}},
        {provide: PageService, useValue: {anchorWithSuffix: () => "", contentPath: () => state.path, contentDescription: () => state.path, pageSubtitle: () => "Photos"}},
        {provide: UrlService, useValue: {redirectToNormalisedUrl: vi.fn(), firstPathSegment: () => "walks"}}
      ]
    });
  });

  afterEach(() => {
    components.forEach(component => component.ngOnDestroy());
    components.splice(0);
  });

  async function initialisedContent(): Promise<DynamicContentComponent> {
    const component = TestBed.runInInjectionContext(() => new DynamicContentComponent());
    components.push(component);
    await component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    return component;
  }

  it("keeps the loaded page intact when opening a photo, moving between photos and returning to the grid", async () => {
    const component = await initialisedContent();
    const loadedPage = component.pageContent;
    expect(loadedPage?.path).toBe(state.path);
    const urls = [
      `${state.path}?${StoredValue.ALBUM_EDIT_VIEW}=details&${StoredValue.ALBUM_EDIT_PHOTO}=1`,
      `${state.path}?${StoredValue.ALBUM_EDIT_VIEW}=details&${StoredValue.ALBUM_EDIT_PHOTO}=2`,
      state.path
    ];
    urls.forEach((url, index) => {
      navigation.next(new NavigationEnd(index + 1, url, url));
      expect(component.pageContent).toBe(loadedPage);
      expect(component.queryCompleted).toBe(true);
    });
    expect(findByPath).toHaveBeenCalledTimes(1);
  });

  it("loads new content when navigating to another page", async () => {
    const component = await initialisedContent();
    state.path = "walks/photos/woodland-trail";
    navigation.next(new NavigationEnd(1, state.path, state.path));
    expect(component.pageContent).toBeNull();
    expect(component.queryCompleted).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(component.pageContent?.path).toBe(state.path);
    expect(findByPath).toHaveBeenCalledTimes(2);
  });

  it("still refreshes content after authentication changes", async () => {
    const component = await initialisedContent();
    authentication.next(null);
    expect(findByPath).toHaveBeenCalledTimes(2);
  });
});
