import { ChangeDetectorRef, Component, Input, OnInit } from "@angular/core";
import has from "lodash-es/has";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { ContentText, ContentTextCategory, View } from "../../../models/content-text.model";
import { MeetupConfig } from "../../../models/meetup-config.model";
import { WalkNotification } from "../../../models/walk-notification.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { ContentTextService } from "../../../services/content-text.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { WalkNotificationService } from "../../../services/walks/walk-notification.service";
import { WalkDisplayService } from "../walk-display.service";
import { MeetupService } from "../../../services/meetup.service";

@Component({
  selector: "app-walk-meetup",
  templateUrl: "./walk-meetup.component.html",
  styleUrls: ["./walk-meetup.component.sass"]
})
export class WalkMeetupComponent implements OnInit {

  @Input()
  public displayedWalk: DisplayedWalk;

  @Input()
  public saveInProgress: boolean;

  public contentTextItems: ContentText[] = [];
  private logger: Logger;
  public notifyTarget: AlertTarget = {};
  protected notify: AlertInstance;
  public walkNotificationData: WalkNotification;
  public config: MeetupConfig;
  meetupEventDescription: string;
  public view: View = View.VIEW;

  constructor(private memberLoginService: MemberLoginService,
              private broadcastService: BroadcastService<ContentText>,
              private changeDetectorRef: ChangeDetectorRef,
              private contentTextService: ContentTextService,
              private notifierService: NotifierService,
              private walkNotificationService: WalkNotificationService,
              public display: WalkDisplayService,
              public meetupService: MeetupService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkMeetupComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:saveInProgress", typeof this.saveInProgress, this.saveInProgress);
    this.meetupService.getConfig().then(config => this.config = config);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.walkNotificationData = this.walkNotificationService.toWalkNotification(this.displayedWalk, this.display.members);
    this.meetupEventDescription = this.displayedWalk.walk.meetupEventDescription;
    this.contentTextService.filterByCategory(ContentTextCategory.MEETUP_DESCRIPTION_PREFIX).then(contentTextItems => {
      this.logger.debug("forCategory", ContentTextCategory.MEETUP_DESCRIPTION_PREFIX + ":", contentTextItems);
      this.contentTextItems = contentTextItems;
    });
    this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_CHANGED, (event: NamedEvent<ContentText>) => this.changeContent(event.data));
    this.broadcastService.on(NamedEventType.MEETUP_DEFAULT_CONTENT_CHANGED, (event: NamedEvent<ContentText>) => this.createMeetupDescription(event.data));
  }

  private changeContent(contentText: ContentText) {
    if (contentText.category === ContentTextCategory.MEETUP_DESCRIPTION_PREFIX) {
      this.logger.info("Received changed content", contentText);
      this.displayedWalk.walk.meetupEventDescription = contentText.text;
    } else {
      this.logger.debug("Ignoring changed content as category", contentText.category, "not correct");
    }
  }

  canUnlinkMeetup() {
    return this.memberLoginService.allowWalkAdminEdits() && this.displayedWalk.walk && this.displayedWalk.walk.meetupEventUrl;
  }

  allowEdits() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) || this.memberLoginService.allowWalkAdminEdits();
  }

  changedPublishMeetup($event: any) {
    if ($event && !this.meetupConfigExists()) {
      if (!this.displayedWalk.walk.config) {
        this.displayedWalk.walk.config = {meetup: this.config};
      } else {
        this.displayedWalk.walk.config.meetup = this.config;
      }
      this.logger.debug("this.displayedWalk.walk", this.displayedWalk.walk);
    }
  }

  public meetupConfigExists() {
    return has(this.displayedWalk.walk, ["config", "meetup"]);
  }

  public meetupEventDescriptionExists() {
    return this.displayedWalk.walk.meetupEventDescription && this.displayedWalk.walk.meetupEventDescription.length > 0;
  }

  private createMeetupDescription(data: ContentText) {
    this.displayedWalk.walk.meetupEventDescription = `${data.text} [here](${this.display.walkLink(this.displayedWalk.walk)}).\n\n${this.displayedWalk.walk.longerDescription}`;
    this.meetupEventDescription = this.displayedWalk.walk.meetupEventDescription;
    this.logger.debug("meetupEventDescription:", this.meetupEventDescription);
    this.changeDetectorRef.detectChanges();
  }

  protected readonly ContentTextCategory = ContentTextCategory;
}
