import { Component, ElementRef, HostListener, inject, Input, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PapercutBackgroundBanner } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import { ServerFileNameData } from "../../models/aws-object.model";
import { NgStyle } from "@angular/common";
import { MarkdownComponent } from "ngx-markdown";
import { cropperTransformStyles } from "../../functions/image-cropper-styles";

@Component({
    selector: "app-papercut-output",
    styleUrls: ["./banner.component.sass"],
    template: `
    <div class="d-flex flex-column flex-md-row position-relative">
      <div class="wrapper w-100 position-relative" [ngStyle]="paperCutWrapperStyles()">
        <div class="crop"
          [style.background-image]="paperCutPhotoBackgroundImage()"
          [ngStyle]="paperCutPhotoStyles()"></div>
          <img class="h-100 position-absolute" #paperCutImage
            (load)="setPaperCutImageHeight()"
            [src]="urlService.resourceRelativePathForAWSFileName(banner?.background?.image?.awsFileName)">
        </div>
        <div class="row position-md-absolute w-100 h-100 align-items-center">
          <div class="ms-md-4 ms-lg-5 col-md-6">
            <a class="navbar-brand" [href]="urlService.baseUrl()" aria-current="page" target="_self">
              @if (banner.logo?.image?.awsFileName) {
                <img
                  [src]="urlService.resourceRelativePathForAWSFileName(banner.logo?.image?.awsFileName)"
                  [alt]="banner.logo?.image.originalFileName" [width]="banner.logo?.image?.width"
                  [style.padding.px]="banner?.logo?.image?.padding">
              }</a>
              <h1 markdown ngPreserveWhitespaces [data]="banner.text.value"
              [class]="'display-4 font-weight-bold mt-5 ' + banner.text.class"></h1>
            </div>
          </div>
        </div>
    `,
    imports: [NgStyle, MarkdownComponent]
})

export class BannerPapercutOutputComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("BannerPapercutOutputComponent", NgxLoggerLevel.ERROR);
  urlService = inject(UrlService);
  public banner: PapercutBackgroundBanner;
  public fileNameData: ServerFileNameData;

  @Input("banner") set acceptChangesFrom(banner: PapercutBackgroundBanner) {
    this.logger.debug("banner:input:", banner);
    this.banner = banner;
    this.setPaperCutImageHeight();
  }

  @Input() public tempImage: string;

  @Input() public bannerHeight: number | null;

  @ViewChild("paperCutImage") paperCutImage: ElementRef<HTMLImageElement>;
  public paperCutImageHeight: number;

  @HostListener("window:resize")
  onResize() {
    this.setPaperCutImageHeight();
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:logoAndTextLinesBanner:", this.banner);
  }

  setPaperCutImageHeight() {
    const paperCutImageHeight = this.paperCutImage?.nativeElement?.clientHeight;
    this.logger.debug("papercutHeight:", paperCutImageHeight);
    this.paperCutImageHeight = paperCutImageHeight;
  }

  paperCutWrapperStyles(): any {
    const styles: any = {"overflow": "hidden"};
    if (this.bannerHeight) {
      styles["height.px"] = this.bannerHeight;
      styles["padding-bottom"] = "0";
    }
    return styles;
  }

  paperCutPhotoStyles(): any {
    const focalPoint = this.banner?.photo?.image?.focalPoint;
    const styles: any = {
      "height.px": this.paperCutImageHeight,
      "width.px": this.banner?.background?.image?.width,
      "background-size": "cover",
      "background-position": focalPoint ? `${focalPoint.x}% ${focalPoint.y}%` : "center",
      "background-repeat": "no-repeat"
    };
    if (focalPoint) {
      const zoom = focalPoint.zoom ?? 1;
      if (zoom > 1) {
        styles["background-size"] = `${100 * zoom}% auto`;
      }
      return styles;
    }
    return {...styles, ...cropperTransformStyles(this.banner?.photo?.image?.cropperPosition || null)};
  }

  paperCutPhotoBackgroundImage(): string {
    const src = this.urlService.imageSource(this.tempImage || this.banner?.photo?.image?.awsFileName, true);
    return src ? `url('${src}')` : "none";
  }

}
