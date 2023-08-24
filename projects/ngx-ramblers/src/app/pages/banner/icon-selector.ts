import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FileUtilsService } from "../../file-utils.service";
import { TitleLine } from "../../models/banner-configuration.model";
import { Image, Images, SystemConfig } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";

@Component({
  selector: "app-icon-selector",
  styleUrls: ["./icon-selector.sass"],
  template: `
    <ng-select [compareWith]="imageComparer" [disabled]="!titleLine.showIcon" appearance="outline" [searchable]="false" [clearable]="false"
               placeholder="Select an icon"
               [closeOnSelect]="true"
               (change)="onChange($event)"
               [ngModel]="titleLine.image">
      <ng-option *ngFor="let image of icons?.images" [value]="image">
        <img [alt]="friendlyFileName(image?.originalFileName)" width="25" [src]="urlService.imageSource(image?.awsFileName)"/>
        <span class="ml-2">{{friendlyFileName(image?.originalFileName)}}</span>
      </ng-option>
    </ng-select>
  `
})

export class IconSelectorComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public icons: Images;
  private subscriptions: Subscription[] = [];

  constructor(public stringUtils: StringUtilsService,
              public urlService: UrlService,
              public fileUtils: FileUtilsService,
              private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(IconSelectorComponent, NgxLoggerLevel.OFF);
  }

  @Input()
  public titleLine: TitleLine;

  @Input()
  public label: string;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.icons = config.icons;
        this.logger.info("retrieved icons", this.icons);
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  imageComparer(item1: Image, item2: Image): boolean {
    return item1?.awsFileName === item2?.awsFileName;
  }

  onChange(image: any) {
    this.logger.info("onChange:", "this.titleLine before:", this.titleLine, "image", image);
    this.titleLine.image = image;
    this.logger.info("onChange:", "this.titleLine after:", this.titleLine, "image", image);
  }

  audit() {
    this.logger.info("titleLine:", this.titleLine);
  }

  friendlyFileName(fileName: string): string {
    this.logger.debug("friendlyFileName:fileName:", fileName);
    return this.stringUtils.asTitle(this.fileUtils.fileNameNoExtension(fileName)).toLowerCase();
  }
}

