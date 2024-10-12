import { Component, Input, OnInit } from "@angular/core";
import { faEnvelope, faFile, faHouse, faMapMarkerAlt, faPhone } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { SocialEvent } from "../../../models/social-events.model";
import { Actions } from "../../../models/ui-actions";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SocialEventsService } from "../../../services/social-events/social-events.service";
import { UrlService } from "../../../services/url.service";
import { SocialDisplayService } from "../social-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { faMeetup } from "@fortawesome/free-brands-svg-icons";

@Component({
  selector: "app-social-view",
  templateUrl: "./social-view.html",
  styleUrls: ["social-view.sass"]
})
export class SocialViewComponent implements OnInit {
  @Input()
  public socialEvent: SocialEvent;
  @Input()
  public actions: Actions;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  private logger: Logger;
  faEnvelope = faEnvelope;
  faPhone = faPhone;
  faMapMarkerAlt = faMapMarkerAlt;
  faHouse = faHouse;
  faFile = faFile;
  constructor(
    public googleMapsService: GoogleMapsService,
    private notifierService: NotifierService,
    public display: SocialDisplayService,
    public urlService: UrlService,
    private systemConfigService: SystemConfigService,
    private socialEventsService: SocialEventsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialViewComponent, NgxLoggerLevel.ERROR);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:socialEvent:", this.socialEvent);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.systemConfigService.events().subscribe(item => {
      if (this.socialEvent) {
        this.logger.info("socialEvent from input:", this.socialEvent);
        this.notifySocialEventDisplayed()
      } else if (this.urlService.pathContainsEventId()) {
        const socialEventId = this.urlService.lastPathSegment();
        this.logger.info("finding socialEvent from socialEventId:", socialEventId);
        this.socialEventsService.queryForId(socialEventId).then(data => {
          this.socialEvent = data;
          this.notifySocialEventDisplayed()
        });
      } else if (this.display.inNewEventMode()) {
        this.logger.info("creating new social event");
        this.editSocialEvent();
      }
    });
  }

  notifySocialEventDisplayed(){
    this.notify.success({
      title: "Single social event showing",
      message: " - "
    });
  }
  editSocialEvent() {
    this.display.confirm.clear();
    const existingRecordEditEnabled = this.display.allow.edits;
    this.display.allow.copy = existingRecordEditEnabled;
    this.display.allow.delete = existingRecordEditEnabled;
    this.actions.activateEditMode();
  }

  protected readonly faMeetup = faMeetup;
}
