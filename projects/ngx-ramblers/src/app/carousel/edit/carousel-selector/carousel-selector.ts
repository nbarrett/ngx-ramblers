import { Component, Input, OnInit } from "@angular/core";
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
import { faEye } from "@fortawesome/free-solid-svg-icons";
import { PageContentService } from "../../../services/page-content.service";
import { StoredValue } from "../../../models/ui-actions";

@Component({
  selector: "app-carousel-selector",
  template: `
    <div *ngIf="allow.edit && contentMetadataItems">
      <div class="row">
        <div class="col-sm-12 mb-2 mt-2">
          <h6>Edit images from</h6>
          <div class="form-inline">
            <app-carousel-select [maxWidth]="250" [name]="name" (metadataChange)="metadataChange($event)"></app-carousel-select>
            <app-badge-button [disabled]="!contentMetadata"
                              caption="View images"
                              (click)="navigateTo(contentMetadata.name)"
                              [icon]="faEye">
            </app-badge-button>
          </div>
        </div>
      </div>
    </div>`,
  standalone: false
})
export class CarouselSelectorComponent implements OnInit {

  constructor(
    public contentMetadataService: ContentMetadataService,
    private notifierService: NotifierService,
    public pageContentService: PageContentService,
    public stringUtils: StringUtilsService,
    private memberLoginService: MemberLoginService,
    private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CarouselEditorComponent", NgxLoggerLevel.OFF);
  }

  private logger: Logger;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public allow: MemberResourcesPermissions = {};
  public contentMetadataItems: ContentMetadata[];
  public contentMetadata: ContentMetadata;

  @Input()
  public name: string;

  protected readonly faEye = faEye;

  ngOnInit() {
    this.logger.debug("ngOnInit:imageSource", this.name);
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
      this.contentMetadata = allAndSelectedContentMetaData.contentMetadata;
      this.notify.clearBusy();
    });
  }

  navigateTo(carouselName: string) {
    this.urlService.navigateUnconditionallyTo(["admin", "carousel-editor"], {[StoredValue.CAROUSEL]: carouselName});
  }

  metadataChange(contentMetadata: ContentMetadata) {
    this.contentMetadata = contentMetadata;
  }
}
