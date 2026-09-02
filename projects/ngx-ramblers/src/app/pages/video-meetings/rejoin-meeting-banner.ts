import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faVideo } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { MeetingRejoinOffer } from "../../models/video-meeting.model";
import { forgetActiveMeetingRoom, meetingRejoinOffer } from "../../functions/video-meeting-client";
import { videoMeetingTitleFromRoom } from "../../functions/video-meeting-join";

@Component({
  selector: "app-rejoin-meeting-banner",
  imports: [AlertPanelComponent, FontAwesomeModule],
  template: `
    @if (offer) {
      <app-alert-panel class="d-block mt-3" title="You have left a meeting that may still be running" [icon]="faVideo" actionsEnd>
        You were in {{ meetingTitle }}. You can go straight back in.
        <button alertActions type="button" class="btn btn-primary text-nowrap" (click)="rejoin()">
          <fa-icon [icon]="faVideo" class="me-2"/>Rejoin meeting
        </button>
        <button alertActions type="button" class="btn btn-quiet text-nowrap" (click)="dismiss()">I have finished</button>
      </app-alert-panel>
    }
  `
})
export class RejoinMeetingBannerComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private logger: Logger = inject(LoggerFactory).createLogger("RejoinMeetingBannerComponent", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];
  offer: MeetingRejoinOffer | null = null;
  faVideo = faVideo;

  ngOnInit(): void {
    this.refresh();
    this.subscriptions.push(this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.refresh()));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get meetingTitle(): string {
    return videoMeetingTitleFromRoom(this.offer?.room || "") || "a video meeting";
  }

  rejoin(): void {
    if (this.offer) {
      void this.router.navigateByUrl(this.offer.path);
    }
  }

  dismiss(): void {
    const storage = this.storage();
    if (storage) {
      forgetActiveMeetingRoom(storage);
    }
    this.offer = null;
  }

  private refresh(): void {
    const storage = this.storage();
    this.offer = storage ? meetingRejoinOffer(storage, this.router.url) : null;
  }

  private storage(): Storage | null {
    try {
      return window.sessionStorage;
    } catch (error) {
      this.logger.info("meeting room memory is not available", error);
      return null;
    }
  }
}
