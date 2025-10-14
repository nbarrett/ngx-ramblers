import { Component, inject, Input, OnInit } from "@angular/core";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faImage, faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { ImageType } from "../../../../models/content-text.model";
import { ImageMessage } from "../../../../models/images.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { UrlService } from "../../../../services/url.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass, NgStyle } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MediaQueryService } from "../../../../services/committee/media-query.service";
import { FALLBACK_MEDIA } from "../../../../models/walk.model";
import { DescribedDimensions } from "../../../../models/aws-object.model";
import { FileUtilsService } from "../../../../file-utils.service";

@Component({
    selector: "app-card-image",
    template: `
    @if (displayImage()) {
      @if (unconstrainedHeight) {
        <img class="card-img-top" (load)="imageLoaded($event)"
             (error)="imageError($event)"
             [ngStyle]="imageStyles()"
             [ngClass]="{'card-img-fixed-height': fixedHeight}"
             [src]="urlService.imageSource(imageSource, false, true)"
             [alt]="fileUtils.altFrom(alt, imageSource)"
             [routerLink]="urlService.routerLinkUrl(imageLink)">
      }
      @if (!unconstrainedHeight) {
        <img class="card-img-top" [height]="constrainedHeight"
             (load)="imageLoaded($event)"
             (error)="imageError($event)"
             [ngStyle]="imageStyles()"
             [ngClass]="{'card-img-fixed-height': fixedHeight}"
             [src]="urlService.imageSource(imageSource, false, true)"
             [alt]="fileUtils.altFrom(alt, imageSource)"
             [routerLink]="urlService.routerLinkUrl(imageLink)">
      }
    }
    @if (cardMissingImage() || cardShouldHaveIcon()) {
      <div class="row no-image"
           [ngClass]="{'small-icon-container': smallIconContainer}">
        <div class="col align-self-center text-center">
          <fa-icon [icon]="icon || faImage" class="fa-icon fa-3x"></fa-icon>
          @if (!icon) {
            <div>{{ imageText }}</div>
          }
        </div>
      </div>
    }`,
    styleUrls: ["./card-image.sass"],
    host: {class: "d-block w-100"},
    imports: [NgStyle, NgClass, RouterLink, FontAwesomeModule]
})
export class CardImageComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("CardImageComponent", NgxLoggerLevel.ERROR);
  urlService = inject(UrlService);
  public fileUtils: FileUtilsService = inject(FileUtilsService);
  mediaQueryService = inject(MediaQueryService);
  faImage = faImage;
  public constrainedHeight: number;
  public imageText = null;
  public imageSource: string;

  @Input("imageSource") set acceptChangesFrom(imageSource: string) {
    this.imageSource = imageSource || FALLBACK_MEDIA.url;
    if (!imageSource) {
      this.imageText = ImageMessage.NO_IMAGE_AVAILABLE;
    } else {
      this.imageText = null;
    }
    this.logger.info("imageSource:", imageSource, " imageText:", this.imageText);
  }

  @Input("height") set acceptHeightChangesFrom(height: number) {
    this.height = height;
    this.handleHeightChange();
  }

  @Input("unconstrainedHeight") set unconstrainedHeightValue(unconstrainedHeight: boolean) {
    this.unconstrainedHeight = coerceBooleanProperty(unconstrainedHeight);
  }

  @Input("fixedHeight") set fixedHeightValue(fixedHeight: boolean) {
    this.fixedHeight = coerceBooleanProperty(fixedHeight);
  }

  @Input("smallIconContainer") set smallIconContainerValue(smallIconContainer: boolean) {
    this.smallIconContainer = coerceBooleanProperty(smallIconContainer);
  }

  @Input() public imageType: ImageType;
  @Input() public imageLink: string;
  @Input() public alt: string;
  @Input() public icon: IconProp;
  @Input() public borderRadius: number;
  @Input() public aspectRatio: DescribedDimensions;

  public height: number;
  public unconstrainedHeight: boolean;
  public fixedHeight: boolean;
  public smallIconContainer: boolean;

  faSearch = faSearch;

  displayImage(): boolean {
    return (!this.imageType || this.imageType === ImageType.IMAGE) && !!this.imageSource && !this.cardImageLoadError();
  }

  cardShouldHaveIcon(): boolean {
    return this.imageType === ImageType.ICON && !!this.icon;
  }

  cardMissingImage(): boolean {
    return this.imageText === ImageMessage.IMAGE_LOAD_ERROR || ((this.imageType === ImageType.IMAGE || !this.imageType) && !this.imageSource);
  }

  cardImageLoadError(): boolean {
    return this.imageText === ImageMessage.IMAGE_LOAD_ERROR;
  }

  ngOnInit() {
    this.logger.info("ngOnInit:imageSource", this.imageSource, "imageLink:", this.imageLink, "icon:", this.icon);
    this.handleHeightChange();
  }

  private handleHeightChange() {
    if (this.unconstrainedHeight) {
      this.constrainedHeight = null;
    } else {
      this.constrainedHeight = this.height || 200;
    }
    this.logger.info("unconstrainedHeight:", this.unconstrainedHeight, "constrainedHeight:", this.constrainedHeight, "height:", this.height);
  }

  imageError(errorEvent: ErrorEvent) {
    this.logger.info("imageError:", errorEvent);
    this.imageText = ImageMessage.IMAGE_LOAD_ERROR;
  }

  imageLoaded(event: Event) {
    this.logger.info("imageLoaded:", event);
    this.imageText = null;
  }

  imageStyles(): any {
    const styles: any = {};
    styles["width"] = "100%";
    if (this.unconstrainedHeight && !this.fixedHeight && !this.constrainedHeight) {
      styles["height"] = "auto";
    }
    if (this.borderRadius) {
      styles["border-radius.px"] = this.borderRadius;
    }
    if (this.aspectRatio && this.imageSource === FALLBACK_MEDIA.url) {
      styles["aspect-ratio"] = `${this.aspectRatio.width} / ${this.aspectRatio.height}`;
      styles["object-fit"] = "cover";
    }
    return styles;
  }
}
