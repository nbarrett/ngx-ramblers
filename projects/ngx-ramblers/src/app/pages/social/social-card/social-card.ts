import { Component, Input, OnInit } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { SocialEvent } from "../../../models/social-events.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";

@Component({
  selector: "app-social-card",
  template: `
    <div class="card shadow clickable h-100">
      <app-card-image [imageLink]="display.socialEventLink(socialEvent, true)"
                      [imageSource]="imageSourceOrPreview()">
      </app-card-image>
      <div class="card-body">
        <h4 class="card-title">
          <a class="rams-text-decoration-pink"
             [routerLink]="urlService.routerLinkUrl(display.socialEventLink(socialEvent, true))"
             target="_self">{{ socialEvent.briefDescription }}</a>
        </h4>
        <ul class="list-arrow">
          <li>{{ socialEvent.eventDate | displayDay }}</li>
          <li *ngIf="socialEvent?.eventTimeStart">Time: {{ socialEvent | eventTimes }}</li>
        </ul>
      </div>
    </div>`,
  standalone: false
})
export class SocialCardComponent implements OnInit {
  public socialEvents: SocialEvent[] = [];
  public notify: AlertInstance;
  private logger: Logger;

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
    this.logger.info("socialEvent:", this.socialEvent);
  }

  imageSourceOrPreview(): string {
    return this.imagePreview || this.socialEvent?.thumbnail;
  }

}
