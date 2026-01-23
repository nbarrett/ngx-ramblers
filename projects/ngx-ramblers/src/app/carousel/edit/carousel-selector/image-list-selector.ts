import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { ContentMetadata } from "../../../models/content-metadata.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { UrlService } from "../../../services/url.service";
import { MemberResourcesPermissions } from "../../../models/member-resource.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { faCheck, faCopy, faEraser, faEye, faPaste, faTimes } from "@fortawesome/free-solid-svg-icons";
import { PageContentService } from "../../../services/page-content.service";
import { ClipboardService } from "../../../services/clipboard.service";
import { Confirm, ConfirmType, StoredValue } from "../../../models/ui-actions";
import { BadgeButtonComponent } from "../../../modules/common/badge-button/badge-button";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ImageListSelect } from "./image-list-select";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-image-list-selector",
  template: `
    @if (allow.edit && contentMetadataItems) {
      <div>
        <div class="row">
          <div class="col-sm-12 mb-2 mt-2">
            <h6>Edit images from</h6>
            <app-image-list-select multiple="true" [maxWidth]="1300" [name]="name"
                                   (metadataChange)="metadataChange($event)"/>
            <div class="d-flex gap-2 mt-2 align-items-center">
              @if (confirm.deleteConfirmOutstanding()) {
                <app-badge-button [disabled]="!selectedContentMetadata"
                                  caption="Confirm Delete of Selected Image Lists"
                                  (click)="deleteAlbums()"
                                  [icon]="faEraser"/>
                <app-badge-button [disabled]="!selectedContentMetadata"
                                  caption="Cancel Delete of Selected Image Lists"
                                  (click)="confirm.clear()"
                                  [icon]="faEraser"/>
              } @else if (duplicating) {
                <input type="text" class="form-control" [(ngModel)]="newAlbumName"
                       placeholder="Enter new album name" style="max-width: 400px;"/>
                <app-badge-button caption="Confirm Duplicate"
                                  (click)="confirmDuplicate()"
                                  [icon]="faCheck"/>
                <app-badge-button caption="Cancel"
                                  (click)="cancelDuplicate()"
                                  [icon]="faTimes"/>
              } @else {
                <app-badge-button [disabled]="!selectedContentMetadata|| selectedContentMetadata.length>1"
                                  caption="View Selected Image List"
                                  (click)="navigateToSelected()"
                                  [icon]="faEye"/>
                <app-badge-button [disabled]="!selectedContentMetadata|| selectedContentMetadata.length>1"
                                  caption="Duplicate Selected Image List"
                                  (click)="startDuplicate()"
                                  [icon]="faCopy"/>
                <app-badge-button [disabled]="!selectedContentMetadata"
                                  caption="Delete Selected Image Lists"
                                  (click)="confirm.as(ConfirmType.DELETE)"
                                  [icon]="faEraser"/>
                <app-badge-button [disabled]="!selectedContentMetadata?.length"
                                  caption="Copy Selected Image Lists"
                                  (click)="copyToClipboard()"
                                  [icon]="faCopy"/>
                <app-badge-button caption="Paste Image Lists"
                                  (click)="pasteFromClipboard()"
                                  [icon]="faPaste"/>
              }
            </div>
            @if (selectedContentMetadata?.length) {
              <div class="mt-2">
                Selected: {{ stringUtils.pluraliseWithCount(selectedContentMetadata.length, 'item') }}
                @for (item of selectedContentMetadata; track item) {
                  <span class="badge bg-secondary mx-1">{{ item.name }}</span>
                }
              </div>
            }
          </div>
        </div>
        @if (notifyTarget.showAlert) {
          <div class="row">
            <div class="col-sm-12">
              <div class="flex-grow-1 alert {{notifyTarget.alertClass}}">
                <fa-icon [icon]="notifyTarget.alert.icon"/>
                @if (notifyTarget.alertTitle) {
                  <strong> {{ notifyTarget.alertTitle }}: </strong>
                }
                {{ notifyTarget.alertMessage }}
              </div>
            </div>
          </div>
        }
      </div>
    }`,
  imports: [ImageListSelect, BadgeButtonComponent, FontAwesomeModule, FormsModule]
})
export class ImageListSelectorComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("CarouselSelectorComponent", NgxLoggerLevel.ERROR);
  contentMetadataService = inject(ContentMetadataService);
  private notifierService = inject(NotifierService);
  pageContentService = inject(PageContentService);
  stringUtils = inject(StringUtilsService);
  private memberLoginService = inject(MemberLoginService);
  private urlService = inject(UrlService);
  private clipboardService = inject(ClipboardService);
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public allow: MemberResourcesPermissions = {};
  public contentMetadataItems: ContentMetadata[];
  public selectedContentMetadata: ContentMetadata[] = [];
  protected readonly faEye = faEye;
  protected readonly faCopy = faCopy;
  protected readonly faCheck = faCheck;
  protected readonly faTimes = faTimes;
  public confirm = new Confirm();
  public duplicating = false;
  public newAlbumName = "";
  @Input()
  public name: string;

  protected readonly faEraser = faEraser;
  protected readonly faPaste = faPaste;

  protected readonly Confirm = Confirm;
  protected readonly ConfirmType = ConfirmType;

  ngOnInit() {
    this.logger.info("ngOnInit:imageSource", this.name);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.refreshImageMetaData();
    this.applyAllowEdits();
  }

  applyAllowEdits() {
    this.allow.edit = this.memberLoginService.allowContentEdits();
  }

  refreshImageMetaData() {
    this.notify.setBusy();
    this.contentMetadataService.refreshLookups()
      .catch(response => this.notify.error({title: "Failed to refresh content metadata", message: response}));
    this.contentMetadataService.contentMetadataNotifications().subscribe(item => {
      const allAndSelectedContentMetaData = this.contentMetadataService.selectMetadataBasedOn(this.name, item);
      this.contentMetadataItems = allAndSelectedContentMetaData.contentMetadataItems;
      this.selectedContentMetadata = allAndSelectedContentMetaData.contentMetadata ? [allAndSelectedContentMetaData.contentMetadata] : []; // Initialize as array
      this.notify.clearBusy();
    });
  }

  navigateToSelected(): Promise<boolean> {
    if (this.selectedContentMetadata.length === 1) {
      return this.urlService.navigateUnconditionallyTo(["admin", "carousel-editor"], {[StoredValue.CAROUSEL]: this.selectedContentMetadata[0].name});
    }
    this.notify.warning({title: "Image List View", message: "Please select only one image list to view."});
    return Promise.resolve(false);
  }

  deleteAlbums() {
    if (this.selectedContentMetadata?.length > 0) {
      Promise.all(this.selectedContentMetadata.map(item => this.contentMetadataService.delete(item)))
        .then(() => {
          this.notify.success({
            title: "Image List deletion",
            message: this.stringUtils.pluraliseWithCount(this.selectedContentMetadata.length, "Image List") + " deleted successfully."
          });
          this.confirm.clear();
          this.refreshImageMetaData();
        })
        .catch(response => this.notify.error({
          title: "Failed to delete Image Lists",
          message: response
        }));
    } else {
      this.notify.error({
        title: "Image List deletion",
        message: "No Image Lists selected for deletion."
      });
    }
  }

  metadataChange(contentMetadata: ContentMetadata[]) {
    this.selectedContentMetadata = contentMetadata || [];
    this.logger.info("metadataChange:selectedContentMetadata", this.selectedContentMetadata);

  }

  startDuplicate() {
    if (this.selectedContentMetadata?.length === 1) {
      const source = this.selectedContentMetadata[0];
      this.newAlbumName = `${source.name}-copy`;
      this.duplicating = true;
    } else {
      this.notify.warning({
        title: "Image List duplication",
        message: "Please select exactly one image list to duplicate."
      });
    }
  }

  cancelDuplicate() {
    this.duplicating = false;
    this.newAlbumName = "";
  }

  confirmDuplicate() {
    if (this.newAlbumName && this.newAlbumName.trim()) {
      const source = this.selectedContentMetadata[0];
      const trimmedName = this.newAlbumName.trim();
      const duplicate: ContentMetadata = {
        ...source,
        id: undefined,
        name: trimmedName,
        files: source.files?.map(file => ({...file, _id: undefined})) || []
      };

      this.contentMetadataService.create(duplicate)
        .then(() => {
          this.notify.success({
            title: "Image List duplicated",
            message: `Image List "${source.name}" duplicated as "${trimmedName}"`
          });
          this.duplicating = false;
          this.newAlbumName = "";
          this.refreshImageMetaData();
        })
        .catch(response => this.notify.error({
          title: "Failed to duplicate Image List",
          message: response
        }));
    }
  }

  copyToClipboard() {
    if (this.selectedContentMetadata?.length > 0) {
      const exportDataArray = this.selectedContentMetadata.map(source => {
        const exportData: ContentMetadata = {
          ...source,
          id: undefined,
          files: source.files?.map(file => ({...file, _id: undefined})) || []
        };
        delete (exportData as any)._id;
        return exportData;
      });
      const totalImages = exportDataArray.reduce((sum, item) => sum + (item.files?.length || 0), 0);
      const json = JSON.stringify(exportDataArray.length === 1 ? exportDataArray[0] : exportDataArray, null, 2);
      this.clipboardService.copyToClipboard(json)
        .then(() => {
          this.notify.success({
            title: "Image Lists copied",
            message: `${this.stringUtils.pluraliseWithCount(exportDataArray.length, "Image List")} with ${this.stringUtils.pluraliseWithCount(totalImages, "image")} copied to clipboard`
          });
        });
    }
  }

  async pasteFromClipboard() {
    try {
      const clipboardText = await this.clipboardService.readFromClipboard();
      if (!clipboardText) {
        this.notify.warning({title: "Paste Image List", message: "No data found in clipboard"});
        return;
      }
      const parsed = JSON.parse(clipboardText);
      const itemsToPaste: ContentMetadata[] = Array.isArray(parsed) ? parsed : [parsed];
      if (itemsToPaste.some(item => !item.name || !item.files)) {
        this.notify.warning({title: "Paste Image List", message: "Invalid Image List format in clipboard"});
        return;
      }
      const existingNames = this.contentMetadataItems.map(item => item.name);
      const existingTagKeys = this.collectAllTagKeys();
      let nextTagKey = Math.max(...existingTagKeys, 0) + 1;
      const createdItems: ContentMetadata[] = [];
      for (const item of itemsToPaste) {
        let newName = item.name;
        let suffix = 1;
        while (existingNames.includes(newName)) {
          newName = `${item.name}-imported-${suffix}`;
          suffix++;
        }
        existingNames.push(newName);
        const tagKeyMapping = new Map<number, number>();
        const remappedTags = item.imageTags?.map(tag => {
          if (tag.key !== undefined && tag.key > 0 && existingTagKeys.includes(tag.key)) {
            const newKey = nextTagKey++;
            tagKeyMapping.set(tag.key, newKey);
            existingTagKeys.push(newKey);
            return {...tag, key: newKey};
          }
          return tag;
        }) || [];
        const remappedFiles = item.files.map(file => {
          const remappedFileTags = file.tags?.map(tagKey => tagKeyMapping.get(tagKey) ?? tagKey);
          return {...file, _id: undefined, tags: remappedFileTags};
        });
        const importData: ContentMetadata = {
          ...item,
          id: undefined,
          name: newName,
          imageTags: remappedTags,
          files: remappedFiles
        };
        delete (importData as any)._id;
        createdItems.push(importData);
      }
      const totalImages = createdItems.reduce((sum, item) => sum + (item.files?.length || 0), 0);
      await Promise.all(createdItems.map(item => this.contentMetadataService.create(item)));
      this.notify.success({
        title: "Image Lists pasted",
        message: `${this.stringUtils.pluraliseWithCount(createdItems.length, "Image List")} created with ${this.stringUtils.pluraliseWithCount(totalImages, "image")}`
      });
      this.refreshImageMetaData();
    } catch (error) {
      this.logger.error("Failed to paste from clipboard", error);
      this.notify.error({title: "Paste Image List", message: "Failed to parse clipboard content as Image List"});
    }
  }

  private collectAllTagKeys(): number[] {
    const keys: number[] = [];
    this.contentMetadataItems?.forEach(item => {
      item.imageTags?.forEach(tag => {
        if (tag.key !== undefined && tag.key > 0) {
          keys.push(tag.key);
        }
      });
    });
    return keys;
  }
}
