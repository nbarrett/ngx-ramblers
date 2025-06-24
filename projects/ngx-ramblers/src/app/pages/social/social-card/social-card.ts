import { Component, inject, Input, OnInit } from "@angular/core";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";
import { CardImageComponent } from "../../../modules/common/card/image/card-image";
import { RouterLink } from "@angular/router";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { EventDatesAndTimesPipe } from "../../../pipes/event-times-and-dates.pipe";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { BasicMedia } from "../../../models/ramblers-walks-manager";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { DateUtilsService } from "../../../services/date-utils.service";

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
               target="_self">{{ socialEvent?.groupEvent?.title }}</a>
          </h4>
          <div>{{ socialEvent | eventDatesAndTimes }}</div>
        </div>
      </div>`,
  providers: [DateUtilsService],
  imports: [CardImageComponent, RouterLink, DisplayDayPipe, EventDatesAndTimesPipe]
})
export class SocialCardComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialCardComponent", NgxLoggerLevel.ERROR);
  display = inject(SocialDisplayService);
  urlService = inject(UrlService);
  mediaQueryService = inject(MediaQueryService);
  public notify: AlertInstance;

  @Input()
  public socialEvent: ExtendedGroupEvent;
  @Input()
  public imagePreview: string;

  faSearch = faSearch;

  ngOnInit() {
    this.logger.info("socialEvent:", this.socialEvent);
  }

  currentBasicMedia(): BasicMedia {
    return this.mediaQueryService.basicMediaFrom(this.socialEvent?.groupEvent)?.[0];
  }


  imageSourceOrPreview(): string {
    return this.imagePreview || this.currentBasicMedia()?.url;
  }

}
