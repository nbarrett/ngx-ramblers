import { Component, inject, Input, OnInit } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { SocialEvent } from "../../../models/social-events.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";
import { CardImageComponent } from "../../../modules/common/card/image/card-image";
import { RouterLink } from "@angular/router";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { EventTimesPipe } from "../../../pipes/event-times.pipe";

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
          @if (socialEvent?.eventTimeStart) {
            <li>Time: {{ socialEvent | eventTimes }}</li>
          }
        </ul>
      </div>
    </div>`,
    imports: [CardImageComponent, RouterLink, DisplayDayPipe, EventTimesPipe]
})
export class SocialCardComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialCardComponent", NgxLoggerLevel.ERROR);
  display = inject(SocialDisplayService);
  urlService = inject(UrlService);
  public socialEvents: SocialEvent[] = [];
  public notify: AlertInstance;

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
