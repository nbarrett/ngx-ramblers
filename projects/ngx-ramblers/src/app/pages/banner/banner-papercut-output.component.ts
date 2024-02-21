import { Component, ElementRef, HostListener, Input, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PapercutBackgroundBanner } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import { ServerFileNameData } from "../../models/aws-object.model";

@Component({
  selector: "app-papercut-output",
  styleUrls: ["./banner.component.sass"],
  template: `
    <div class="d-flex flex-column flex-md-row position-relative">
      <div class="wrapper w-100 position-relative">
        <img class="crop"
             [src]="urlService.imageSource(this.tempImage || banner?.photo?.image?.awsFileName)"
             (load)="setPaperCutImageHeight()"
             [ngStyle]="{'height.px': paperCutImageHeight, 'width.px': banner.background.image.width}"/><img/>
        <img class="h-100 position-absolute" #paperCutImage
             [src]="urlService.resourceRelativePathForAWSFileName(banner?.background?.image?.awsFileName)">
      </div>
      <div class="row position-md-absolute w-100 h-100 align-items-center">
        <div class="ml-md-4 ml-lg-5 col-md-6">
          <a class="navbar-brand" [href]="urlService.baseUrl()" aria-current="page" target="_self">
            <img *ngIf="banner.logo?.image?.awsFileName"
                 [src]="urlService.resourceRelativePathForAWSFileName(banner.logo?.image?.awsFileName)"
                 [alt]="banner.logo?.image.originalFileName" [width]="banner.logo?.image?.width"
                 [style.padding.px]="banner?.logo?.image?.padding"></a>
          <h1 markdown ngPreserveWhitespaces [data]="banner.text.value"
              [class]="'display-4 font-weight-bold mt-5 ' + banner.text.class"></h1>
        </div>
      </div>
    </div>
  `
})

export class BannerPapercutOutputComponent implements OnInit {
  public banner: PapercutBackgroundBanner;
  public fileNameData: ServerFileNameData;

  @Input("banner") set acceptChangesFrom(banner: PapercutBackgroundBanner) {
    this.logger.debug("banner:input:", banner);
    this.banner = banner;
    this.setPaperCutImageHeight();
  }

  @Input() public tempImage: string;

  @ViewChild("paperCutImage") paperCutImage: ElementRef<HTMLImageElement>;
  private logger: Logger;
  public paperCutImageHeight: number;

  @HostListener("window:resize", ["$event"])
  onResize(event) {
    this.setPaperCutImageHeight();
  }

  constructor(
    public urlService: UrlService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BannerPapercutOutputComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:logoAndTextLinesBanner:", this.banner);
  }

  setPaperCutImageHeight() {
    const paperCutImageHeight = this.paperCutImage?.nativeElement?.clientHeight;
    this.logger.debug("papercutHeight:", paperCutImageHeight);
    this.paperCutImageHeight = paperCutImageHeight;
  }

}
