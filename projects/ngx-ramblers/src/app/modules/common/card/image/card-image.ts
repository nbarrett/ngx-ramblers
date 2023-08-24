import { Component, Input, OnInit } from "@angular/core";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faImage, faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { ImageType } from "../../../../models/content-text.model";
import { ImageMessage } from "../../../../models/images.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { UrlService } from "../../../../services/url.service";

@Component({
  selector: "app-card-image",
  templateUrl: "./card-image.html",
  styleUrls: ["./card-image.sass"]
})
export class CardImageComponent implements OnInit {
  private logger: Logger;
  faImage = faImage;
  public height: any;

  constructor(public urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CardImageComponent, NgxLoggerLevel.OFF);
  }
  public imageText = null;
  public imageSource: string;

  @Input("imageSource") set acceptChangesFrom(imageSource: string) {
    this.logger.debug("imageSource:", imageSource);
    this.imageSource = imageSource;
    if (!imageSource) {
      this.imageText = ImageMessage.NO_IMAGE_AVAILABLE;
    } else {
      this.imageText = null;
    }
  }

  @Input()
  public imageType: ImageType;
  @Input()
  public imageLink: string;
  @Input()
  public icon: IconProp;
  @Input()
  public unconstrainedHeight: boolean;
  @Input()
  public smallIconContainer: boolean;
  @Input()
  public borderRadius: number;

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
    if (this.unconstrainedHeight) {
      this.height = null;
    } else {
      this.height = 200;
    }
  }

  imageError(errorEvent: ErrorEvent) {
    this.logger.info("imageError:", errorEvent);
    this.imageText = ImageMessage.IMAGE_LOAD_ERROR;
  }

  imageLoaded(event: Event) {
    this.logger.info("imageLoaded:", event);
    this.imageText = null;
  }
}
