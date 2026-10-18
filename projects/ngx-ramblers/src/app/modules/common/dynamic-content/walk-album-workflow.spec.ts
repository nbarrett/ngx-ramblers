import { Location } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { LoggerTestingModule } from "ngx-logger/testing";
import { of } from "rxjs";
import { vi } from "vitest";
import { WalkAlbumWorkflow } from "./walk-album-workflow";
import { ContentTextEditor } from "../tiptap-editor/content-text-editor";
import { ImageListEditComponent } from "../../../carousel/edit/image-list-edit/image-list-edit";
import { SocialShareAlbumComponent } from "../../../carousel/edit/social-share-album/social-share-album";
import { ContentText, PageContentType, View } from "../../../models/content-text.model";
import { AlbumEditRole } from "../../../models/content-metadata.model";
import { PageContentService } from "../../../services/page-content.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { CreateWalkAlbumService } from "../../../services/walks/create-walk-album.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { MemberLoginService } from "../../../services/member/member-login.service";

@Component({selector: "app-content-text-editor", template: "", inputs: ["name", "description"]})
class ReportEditorStub {
  @Input() text: string;
  @Input() initialView: View;
  @Input() autoFocus: boolean;
  @Output() changed = new EventEmitter<ContentText>();
}

@Component({selector: "app-image-list-edit", template: "<ng-content/>", inputs: ["name", "workflowMode", "role", "contributorIdentity"]})
class PhotosStub {
  @Output() exit = new EventEmitter();
}

describe("assisted album report", () => {
  const savePage = vi.fn().mockResolvedValue(null);

  beforeEach(async () => {
    savePage.mockClear();
    await TestBed.configureTestingModule({
      imports: [WalkAlbumWorkflow, LoggerTestingModule],
      providers: [
        {provide: Location, useValue: {back: vi.fn()}},
        {provide: PageContentService, useValue: {createOrUpdate: savePage}},
        {provide: ContentMetadataService, useValue: {}},
        {provide: SystemConfigService, useValue: {events: () => of({})}},
        {provide: CreateWalkAlbumService, useValue: {}},
        {provide: SiteEditService, useValue: {}},
        {provide: MemberLoginService, useValue: {memberLoggedIn: () => false}}
      ]
    }).overrideComponent(WalkAlbumWorkflow, {
      remove: {imports: [ContentTextEditor, ImageListEditComponent, SocialShareAlbumComponent]},
      add: {imports: [ReportEditorStub, PhotosStub]}
    }).compileComponents();
  });

  function report() {
    const fixture = TestBed.createComponent(WalkAlbumWorkflow);
    fixture.componentInstance.row = {type: PageContentType.ALBUM, carousel: {name: "hillside-park", preAlbumText: "An afternoon exploring Hillside Park."}} as any;
    fixture.componentInstance.pageContent = {path: "walks/photos/hillside-park", rows: [fixture.componentInstance.row]};
    fixture.detectChanges();
    return fixture;
  }

  it("opens the suggested report directly in edit mode without requiring site edit mode", () => {
    const fixture = report();
    const editor = fixture.debugElement.query(By.directive(ReportEditorStub)).componentInstance as ReportEditorStub;
    expect(editor.initialView).toBe(View.EDIT);
    expect(editor.autoFocus).toBe(true);
    expect(editor.text).toBe("An afternoon exploring Hillside Park.");
    expect(fixture.nativeElement.textContent).toContain("Edit the suggested text below");
  });

  it("saves the edited report in the album page", async () => {
    const fixture = report();
    const editor = fixture.debugElement.query(By.directive(ReportEditorStub)).componentInstance as ReportEditorStub;
    editor.changed.emit({text: "We explored the woodland paths and stopped beside the lake."});
    await Promise.resolve();
    expect(fixture.componentInstance.row.carousel.preAlbumText).toBe("We explored the woodland paths and stopped beside the lake.");
    expect(savePage).toHaveBeenCalledWith(fixture.componentInstance.pageContent);
  });

  it("does not offer the report editor to a photo contributor", () => {
    const fixture = report();
    fixture.componentRef.setInput("role", AlbumEditRole.CONTRIBUTOR);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(ReportEditorStub))).toBeNull();
  });
});
