import { Component, Input, OnInit } from "@angular/core";
import { faCopy, faImage, faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { SocialEvent } from "../../../models/social-events.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";

@Component({
  selector: "app-social-card",
  templateUrl: "./social-card.html",
  styleUrls: ["./social-card.sass"]
})
export class SocialCardComponent implements OnInit {
  public socialEvents: SocialEvent[] = [];
  public notify: AlertInstance;
  private logger: Logger;
  faCopy = faCopy;
  faImage = faImage;

  constructor(
    public display: SocialDisplayService,
    public urlService: UrlService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialCardComponent, NgxLoggerLevel.OFF);
  }

  @Input()
  public socialEvent: SocialEvent;
  @Input()
  public imagePreview: string;

  faSearch = faSearch;

  ngOnInit() {
  }

  imageSourceOrPreview(): string {
    return this.imagePreview || this.socialEvent?.thumbnail;
  }

}
