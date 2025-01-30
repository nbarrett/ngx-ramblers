import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FileUtilsService } from "../../file-utils.service";
import { TitleLine } from "../../models/banner-configuration.model";
import { Image, Images, SystemConfig } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";
import { NgOptionComponent, NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-icon-selector",
    styleUrls: ["./icon-selector.sass"],
    template: `
    <ng-select [compareWith]="imageComparer" [disabled]="!titleLine.showIcon" appearance="outline" [searchable]="false" [clearable]="false"
      placeholder="Select an icon"
      [closeOnSelect]="true"
      (change)="onChange($event)"
      [ngModel]="titleLine.image">
      @for (image of icons?.images; track image.awsFileName) {
        <ng-option [value]="image">
          <img [alt]="friendlyFileName(image?.originalFileName)" width="25" [src]="urlService.imageSource(image?.awsFileName)"/>
          <span class="ml-2">{{friendlyFileName(image?.originalFileName)}}</span>
        </ng-option>
      }
    </ng-select>
    `,
    imports: [NgSelectComponent, FormsModule, NgOptionComponent]
})

export class IconSelectorComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("IconSelectorComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  urlService = inject(UrlService);
  fileUtils = inject(FileUtilsService);
  private systemConfigService = inject(SystemConfigService);
  public icons: Images;
  private subscriptions: Subscription[] = [];

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

