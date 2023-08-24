import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { ContentMetadataItem } from "../../../models/content-metadata.model";
import { SocialEventsPermissions } from "../../../models/social-events.model";
import { Confirm } from "../../../models/ui-actions";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";

@Component({
  selector: "app-social-information",
  styleUrls: ["./social-information.component.sass"],
  templateUrl: "./social-information.component.html",
})
export class SocialInformationComponent implements OnInit {
  @Input()
  public notifyTarget: AlertTarget;
  public contentMetadataItem: ContentMetadataItem;
  public slides: ContentMetadataItem[];
  public activeSlideIndex: number;
  public image: any;
  public imageWidth = "80%";
  private logger: Logger;

  constructor(private contentMetadataService: ContentMetadataService,
              public display: SocialDisplayService,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialInformationComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

}
