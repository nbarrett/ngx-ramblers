import { Component, Input, NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FileUploader } from "ng2-file-upload";
import { vi } from "vitest";
import { ButtonDropdownComponent } from "../../../modules/common/button-dropdown/button-dropdown";
import { ImageListEditComponent } from "./image-list-edit";
import { ImageEditComponent } from "../image-edit/image-edit";
import { AspectRatioSelectorComponent } from "../aspect-ratio-selector/aspect-ratio-selector";
import { FileSizeSelectorComponent } from "../file-size-selector/file-size-selector";
import { TagManagerComponent } from "../../../pages/tag/tag-manager.component";
import { AlbumEditRole, AlbumEditorView, ContentMetadataItem } from "../../../models/content-metadata.model";
import { RootFolder } from "../../../models/system.model";
import { StoredValue } from "../../../models/ui-actions";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { PageContentService } from "../../../services/page-content.service";
import { CreateWalkAlbumService } from "../../../services/walks/create-walk-album.service";
import { ImageTagDataService } from "../../../services/image-tag-data-service";
import { ImageDuplicatesService } from "../../../services/image-duplicates-service";
import { FileUploadService } from "../../../services/file-upload.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { UrlService } from "../../../services/url.service";
import { FileUtilsService } from "../../../file-utils.service";

@Component({
  selector: "app-image-edit",
  inputs: ["selectedCover", "index", "role", "duplicateImages", "contentMetadata", "s3Metadata", "contentMetadataImageTags", "filteredFiles", "nonDestructive"],
  template: `<div>{{ item?.text }}</div>`
})
class PhotoEditorStub {
  @Input() item: ContentMetadataItem;
  editActive = false;
}

describe("photo workspace", () => {
  const router = {navigate: vi.fn().mockResolvedValue(true)};
  const images = (count: number): ContentMetadataItem[] => Array.from({length: count}, (_, index) => ({
    image: `photo-${index + 1}.jpg`, originalFileName: `photo-${index + 1}.jpg`, text: `Hillside photo ${index + 1}`, tags: []
  }));

  beforeEach(async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    vi.spyOn(ImageListEditComponent.prototype, "ngOnInit").mockImplementation(() => null);
    router.navigate.mockClear();
    await TestBed.configureTestingModule({
      imports: [ImageListEditComponent, LoggerTestingModule],
      providers: [
        provideNoopAnimations(),
        ...[SystemConfigService, PageContentService, CreateWalkAlbumService, ImageTagDataService, ImageDuplicatesService,
          FileUploadService, WebSocketClientService, HttpClient, ActivatedRoute, FileUtilsService].map(provide => ({provide, useValue: {}})),
        {provide: CreateWalkAlbumService, useValue: {abandonEmptyPendingAlbum: vi.fn().mockResolvedValue(false)}},
        {provide: Router, useValue: router},
        {provide: MemberLoginService, useValue: {memberLoggedIn: () => false}},
        {provide: ContentMetadataService, useValue: {findMetadataFor: () => null}},
        {provide: UrlService, useValue: {isBase64Image: (value: string) => value?.startsWith("data:image/"), imageSourceFor: () => "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}}
      ]
    }).overrideComponent(ImageListEditComponent, {
      remove: {imports: [ImageEditComponent, AspectRatioSelectorComponent, FileSizeSelectorComponent, TagManagerComponent]},
      add: {imports: [PhotoEditorStub], schemas: [NO_ERRORS_SCHEMA]}
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function workspace(count = 39) {
    const fixture = TestBed.createComponent(ImageListEditComponent);
    const component = fixture.componentInstance;
    component.workflowMode = true;
    component.allow.edit = true;
    component.contentMetadata = {name: "hillside-park", rootFolder: RootFolder.carousels, files: images(count), imageTags: [], coverImage: "photo-1.jpg"};
    component.filteredFiles = component.contentMetadata.files;
    component["reorderPageImages"] = component.filteredFiles;
    component.uploader = new FileUploader({url: "/api/example-upload"});
    fixture.changeDetectorRef.detectChanges();
    return fixture;
  }

  it("shows the whole album as lazy thumbnails without creating an editor for every photo", () => {
    const fixture = workspace();
    expect(fixture.nativeElement.querySelectorAll(".image-reorder-item")).toHaveLength(39);
    expect(fixture.nativeElement.querySelectorAll(".image-reorder-preview img[loading=lazy]")).toHaveLength(39);
    expect(fixture.nativeElement.querySelector("app-image-edit")).toBeNull();
    expect(fixture.nativeElement.querySelector("pagination")).toBeNull();
  });

  it("opens just the chosen photo in the existing editor and keeps the choice in the URL", () => {
    const fixture = workspace();
    fixture.nativeElement.querySelectorAll(".image-reorder-preview")[12].click();
    fixture.changeDetectorRef.detectChanges();

    expect(fixture.componentInstance["albumEditorView"]).toBe(AlbumEditorView.DETAILS);
    const editors = fixture.debugElement.queryAll(By.directive(PhotoEditorStub));
    expect(editors).toHaveLength(1);
    expect(editors[0].componentInstance.item).toBe(fixture.componentInstance.filteredFiles[12]);
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({queryParams: {
      [StoredValue.ALBUM_EDIT_VIEW]: AlbumEditorView.DETAILS,
      [StoredValue.ALBUM_EDIT_PHOTO]: 13
    }}));
    expect(fixture.nativeElement.querySelector(".image-reorder-grid")).toBeNull();
  });

  it("keeps unsaved photos in the gallery and allows choosing their cover before upload", () => {
    const fixture = workspace(3);
    const component = fixture.componentInstance;
    component.contentMetadata.files.forEach(item => {
      item.base64Content = "data:image/jpeg;base64,YWJj";
      item.image = null;
    });
    component.contentMetadata.coverImage = null;
    fixture.changeDetectorRef.detectChanges();
    expect(fixture.nativeElement.querySelectorAll(".image-reorder-status")).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll(".image-reorder-cover-badge")).toHaveLength(0);

    component["useAsCover"](component.filteredFiles[1]);
    fixture.changeDetectorRef.detectChanges();

    expect(component["coverImageItem"]()).toBe(component.filteredFiles[1]);
    expect(fixture.nativeElement.querySelectorAll(".image-reorder-cover-badge")).toHaveLength(1);
    expect(component.contentMetadata.coverImage).toBeNull();
  });

  it("does not expose cover and reorder actions to contributors", () => {
    const fixture = workspace(3);
    fixture.componentInstance.role = AlbumEditRole.CONTRIBUTOR;
    fixture.changeDetectorRef.detectChanges();
    expect(fixture.nativeElement.querySelectorAll(".image-reorder-item")).toHaveLength(3);
    expect(fixture.nativeElement.querySelector(".cover-drop-zone")).toBeNull();
    expect(fixture.nativeElement.querySelector(".image-reorder-handle")).toBeNull();
    fixture.componentInstance["useAsCover"](fixture.componentInstance.filteredFiles[1]);
    expect(fixture.componentInstance.contentMetadata.coverImage).toBe("photo-1.jpg");
  });

  it("keeps album settings collapsed and shows preparation errors above the gallery", () => {
    const fixture = workspace(3);
    fixture.componentInstance.workflowMode = false;
    fixture.componentInstance.notify.error({title: "Photo preparation stopped", message: "The photo could not be resized", continue: true});
    fixture.changeDetectorRef.detectChanges();
    expect(fixture.nativeElement.querySelector("details").open).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain("Photo preparation stopped");
  });
  it.each([
    {workflowMode: true, saveLabel: "Save and return to walk"},
    {workflowMode: false, saveLabel: "Save album"}
  ])("shows the album action bar with '$saveLabel'", ({workflowMode, saveLabel}) => {
    const fixture = workspace(3);
    fixture.componentInstance.workflowMode = workflowMode;
    fixture.changeDetectorRef.detectChanges();
    const toolbar = fixture.nativeElement.querySelector(".album-sticky-bar");
    const labels = [...toolbar.querySelectorAll("button")].map(button => button.textContent.replace(/\s+/g, " ").trim());
    expect(labels).toEqual([...(workflowMode ? ["Photo order"] : []), "Add photos", "Take photo", saveLabel, "Discard changes"]);
    expect([...toolbar.querySelectorAll("button")].every(button => button.classList.contains("btn-icon"))).toBe(false);
  });

  it("keeps album saving out of the individual photo editor", () => {
    const fixture = workspace(3);
    fixture.componentInstance["openPhoto"](fixture.componentInstance.filteredFiles[0]);
    fixture.changeDetectorRef.detectChanges();
    const toolbar = fixture.nativeElement.querySelector(".album-sticky-bar");
    expect(toolbar).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("Back to photos");
  });

  it("offers automatic cover selection on Save without saving immediately", () => {
    const fixture = workspace(3);
    const component = fixture.componentInstance;
    const mark = vi.fn();
    Object.assign(component["createWalkAlbumService"], {markAlbumForAutoCover: mark});
    component["autoChooseCover"]();
    fixture.changeDetectorRef.detectChanges();
    expect(mark).toHaveBeenCalledWith("hillside-park");
    expect(component.contentMetadata.coverImage).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("A cover will be chosen automatically when you save");
  });

  it("uses the shared button dropdown for photo order", () => {
    const fixture = workspace(3);
    const dropdown = fixture.debugElement.query(By.directive(ButtonDropdownComponent));
    expect(dropdown).not.toBeNull();
    expect(dropdown.componentInstance.label).toBe("Photo order");
    expect(dropdown.componentInstance.tooltip).toBe("Photo order: Newest first");
    expect(fixture.nativeElement.querySelectorAll(".album-sticky-bar app-button-dropdown")).toHaveLength(1);
    expect(dropdown.componentInstance.items).toHaveLength(4);
    expect(fixture.nativeElement.querySelector("select#album-photo-sort")).toBeNull();
  });

});
