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
import { faEraser, faEye } from "@fortawesome/free-solid-svg-icons";
import { PageContentService } from "../../../services/page-content.service";
import { Confirm, ConfirmType, StoredValue } from "../../../models/ui-actions";
import { BadgeButtonComponent } from "../../../modules/common/badge-button/badge-button";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ImageListSelect } from "./image-list-select";

@Component({
  selector: "app-image-list-selector",
  template: `
    @if (allow.edit && contentMetadataItems) {
      <div>
        <div class="row">
          <div class="col-sm-12 mb-2 mt-2">
            <h6>Edit images from</h6>
            <div class="form-inline">
              <app-image-list-select multiple="true"  [maxWidth]="1300" [name]="name"
                                     (metadataChange)="metadataChange($event)"/>
              @if (confirm.deleteConfirmOutstanding()) {
                <app-badge-button [disabled]="!selectedContentMetadata?.length"
                                  caption="Confirm Delete of Selected Image Lists"
                                  (click)="deleteAlbums()"
                                  [icon]="faEraser"/>
                <app-badge-button [disabled]="!selectedContentMetadata?.length"
                                  caption="Cancel Delete of Selected Image Lists"
                                  (click)="confirm.clear()"
                                  [icon]="faEraser"/>
              } @else {
                <app-badge-button [disabled]="!selectedContentMetadata?.length"
                                  caption="View Selected Image List"
                                  (click)="navigateToSelected()"
                                  [icon]="faEye"/>
                <app-badge-button [disabled]="!selectedContentMetadata?.length"
                                  caption="Delete Selected Image Lists"
                                  (click)="confirm.as(ConfirmType.DELETE)"
                                  [icon]="faEraser"/>
              }
            </div>
            @if (selectedContentMetadata?.length) {
              <div class="mt-2">
                Selected: {{ stringUtils.pluraliseWithCount(selectedContentMetadata.length, 'item') }}
                @for (item of selectedContentMetadata; track item) {
                  <span class="badge badge-secondary mx-1">{{ item.name }}</span>
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
  imports: [ImageListSelect, BadgeButtonComponent, FontAwesomeModule]
})
export class ImageListSelectorComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("CarouselSelectorComponent", NgxLoggerLevel.ERROR);
  contentMetadataService = inject(ContentMetadataService);
  private notifierService = inject(NotifierService);
  pageContentService = inject(PageContentService);
  stringUtils = inject(StringUtilsService);
  private memberLoginService = inject(MemberLoginService);
  private urlService = inject(UrlService);
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public allow: MemberResourcesPermissions = {};
  public contentMetadataItems: ContentMetadata[];
  public selectedContentMetadata: ContentMetadata[] = [];
  protected readonly faEye = faEye;
  public confirm = new Confirm();
  @Input()
  public name: string;

  protected readonly faEraser = faEraser;

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
  }
}
