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
import first from "lodash-es/first";
import { faEye, faStreetView } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-carousel-selector",
  templateUrl: "./carousel-selector.html"
})
export class CarouselSelectorComponent implements OnInit {
  private logger: Logger;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public allow: MemberResourcesPermissions = {};
  public contentMetadataItems: ContentMetadata[];
  public contentMetadata: ContentMetadata;

  @Input()
  public name: string;

  constructor(
    public contentMetadataService: ContentMetadataService,
    private notifierService: NotifierService,
    public stringUtils: StringUtilsService,
    private memberLoginService: MemberLoginService,
    private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CarouselEditorComponent", NgxLoggerLevel.OFF);
  }

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
    this.contentMetadataService.all()
      .then((contentMetaDataItems: ContentMetadata[]) => {
        this.logger.debug("contentMetaDataItems:", contentMetaDataItems);
        this.contentMetadataItems = contentMetaDataItems;
        this.contentMetadata = this.contentMetadataItems.find(item => item.name === this.name) || first(this.contentMetadataItems);
        this.notify.clearBusy();
      })
      .catch(response => this.notify.error({title: "Failed to refresh content metadata", message: response}));
  }

  navigateTo(imageSource: string) {
    this.urlService.navigateUnconditionallyTo("admin", "carousel-editor", imageSource);
  }

  hideHelp() {

  }

  protected readonly faStreetView = faStreetView;
  protected readonly faEye = faEye;
}
