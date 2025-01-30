import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { range } from "lodash-es";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { BannerImageItem } from "../../models/banner-configuration.model";
import { Image, Images, SystemConfig } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-banner-image-selector",
    template: `
    @if (bannerImageItem) {
      <div class="row">
        <div class="col-md-12">
          <h4>
            <div class="custom-control custom-checkbox">
              <input class="custom-control-input"
                [(ngModel)]="bannerImageItem.show"
                type="checkbox"
                id="include-{{imageTypeDescription}}">
              <label class="custom-control-label"
              for="include-{{imageTypeDescription}}">{{imageTypeDescription}}</label>
            </div>
          </h4>
          <select [compareWith]="imageComparer" class="form-control input-sm"
            id="selected-logo-{{imageTypeDescription}}"
            [(ngModel)]="bannerImageItem.image">
            @for (image of images?.images; track image.awsFileName) {
              <option
              [ngValue]="image">{{image.originalFileName}}</option>
            }
          </select>
        </div>
      </div>
    }
    @if (bannerImageItem) {
      <div class="row">
        @if (configurePadding) {
          <div [class]="propertyClass">
            <label>Padding:</label>
            <input [(ngModel)]="bannerImageItem.image.padding"
              type="number" class="form-control input-sm">
          </div>
        }
        @if (configureFontSize) {
          <div [class]="propertyClass">
            <label>Font Size:</label>
            <input [(ngModel)]="bannerImageItem.fontSize"
              type="number" class="form-control input-sm">
          </div>
        }
        @if (configureColumns) {
          <div [class]="propertyClass">
            <label>Columns (1 - 12):</label>
            <select class="form-control input-sm ml-2"
              id="selected-logo-{{imageTypeDescription}}"
              [(ngModel)]="bannerImageItem.columns">
              @for (width of widths; track width) {
                <option
                [ngValue]="width">{{width}}</option>
              }
            </select>
          </div>
        }
        @if (configureWidth) {
          <div [class]="propertyClass">
            <label>Width:</label>
            <input [(ngModel)]="bannerImageItem.image.width"
              type="number" class="form-control input-sm">
          </div>
        }
      </div>
    }
    `,
    imports: [FormsModule]
})

export class BannerImageSelectorComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("BannerImageSelectorComponent", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private systemConfigService = inject(SystemConfigService);
  public images: Images;
  public widths: number[] = range(1, 13);
  public imageTypeDescription: string;
  public propertyClass: string;
  public propertyConfigureCount = 0;
  private subscriptions: Subscription[] = [];

  @Input() bannerImageItem: BannerImageItem;
  @Input() configureWidth: boolean;
  @Input() configureColumns: boolean;
  @Input() configureFontSize: boolean;
  @Input() configurePadding: boolean;

  ngOnInit() {
    this.logger.debug("ngOnInit:bannerImageItem:", this.bannerImageItem);
    if (this.configurePadding) {
      this.propertyConfigureCount++;
    }
    if (this.configureWidth) {
      this.propertyConfigureCount++;
    }
    if (this.configureColumns) {
      this.propertyConfigureCount++;
    }
    if (this.configureFontSize) {
      this.propertyConfigureCount++;
    }
    this.propertyClass = this.configurePropertyClass();
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.logger.info("this.bannerImageItem.bannerImageType", this.bannerImageItem?.bannerImageType, "config:", config);
        if (this.bannerImageItem?.bannerImageType) {
          this.images = config[this.bannerImageItem?.bannerImageType];
        }
        this.imageTypeDescription = this.stringUtils.asTitle(this.bannerImageItem?.bannerImageType.replace("s", ""));
        if (this.images?.images && !this?.bannerImageItem?.image) {
          this.bannerImageItem.image = first(this.images?.images);
        }
        this.logger.info("retrieved images", this.images, "bannerImageItem:", this.bannerImageItem);
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  imageComparer(item1: Image, item2: Image): boolean {
    return item1?.awsFileName === item2?.awsFileName;
  }

  configurePropertyClass(): string {
    switch (this.propertyConfigureCount) {
      case 1:
        return "col-md-12";
      case 2:
        return "col-md-6";
      case 3:
        return "col-md-4";
      case 4:
        return "col-md-3";
    }

  }

}

