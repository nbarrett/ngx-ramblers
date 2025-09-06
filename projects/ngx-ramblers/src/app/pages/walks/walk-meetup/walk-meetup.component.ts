import { ChangeDetectorRef, Component, inject, Input, OnInit } from "@angular/core";
import has from "lodash-es/has";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { ContentText, ContentTextCategory, View } from "../../../models/content-text.model";
import { MeetupConfig } from "../../../models/meetup-config.model";
import { WalkNotification } from "../../../models/walk-notification.model";
import { DisplayedWalk, LinkSource, LinkWithSource } from "../../../models/walk.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { ContentTextService } from "../../../services/content-text.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { WalkNotificationService } from "../../../services/walks/walk-notification.service";
import { WalkDisplayService } from "../walk-display.service";
import { MeetupService } from "../../../services/meetup.service";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FormsModule } from "@angular/forms";
import {
  WalkMeetupConfigParametersComponent
} from "../walk-meetup-config-parameters/walk-meetup-config-parameters.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { LinksService } from "../../../services/links.service";

@Component({
    selector: "app-walk-meetup",
    template: `
      <div class="row img-thumbnail thumbnail-walk-edit">
        <div class="thumbnail-heading">Meetup</div>
        <div class="d-none">
          <ng-template app-notification-directive/>
        </div>
        <div class="col-sm-12">
          <app-markdown-editor name="meetup-help" description="Linking to Meetup"/>
        </div>
        @if (allowEdits()) {
          <div class="col-sm-12">
            <div class="form-check">
              <input [disabled]="!allowEdits() || saveInProgress"
                     (ngModelChange)="changedPublishMeetup($event)"
                     [(ngModel)]="displayedWalk.walk.fields.publishing.meetup"
                     type="checkbox" class="form-check-input" id="walk-publish-meetup">
              <label class="form-check-label"
                     for="walk-publish-meetup">Publish this walk to Meetup
              </label>
            </div>
          </div>
        }
        @if (displayedWalk?.walk.fields.publishing.meetup) {
          <div class="col-sm-12">
            @if (contentTextItems.length > 0 && meetupConfigExists()) {
              <app-walk-meetup-config-parameters
                [contentTextItems]="contentTextItems"
                [renderMarkdownField]="!meetupEventDescriptionExists()"
                [config]="displayedWalk?.walk?.fields.meetup"/>
            }
          </div>
          <div class="col-sm-12 mb-2 mt-3">
            @if (meetupConfigExists()) {
              <app-markdown-editor
                [initialView]="view"
                [name]="'meetup-event-description'"
                [category]="ContentTextCategory.MEETUP_DESCRIPTION_PREFIX"
                [text]="meetupEventDescription"
                [rows]="7"
                [description]="'Meetup event description'"/>
            }
          </div>
          @if (linkWithSource?.href) {
            <div class="col-sm-12">
              <div class="form-group">
                <label for="meetup-event-url">Meetup Event Url</label>
                <input [(ngModel)]="linkWithSource.href"
                       [disabled]="inputDisabled()"
                       type="text" class="form-control input-sm"
                       id="meetup-event-url"
                       placeholder="Enter URL to Meetup Event">
              </div>
            </div>
          }
          @if (allowEdits()) {
            <div class="col-sm-12">
              @if (linkWithSource?.href) {
                <div class="form-group">
                  <label>Link preview:
                    <img class="related-links-image" src="/assets/images/local/meetup.ico"
                         alt=""/>
                    <a target="_blank"
                       [href]="linkWithSource.href">
                    <span class="related-links-title"
                          tooltip="Click to view this walk in Meetup">
                    View {{ meetupService.meetupPublishedStatus(displayedWalk) }} event on Meetup</span>
                    </a></label>
                </div>
              }
            </div>
          }
        }
      </div>`,
    imports: [NotificationDirective, MarkdownEditorComponent, FormsModule, WalkMeetupConfigParametersComponent, TooltipDirective]
})
export class WalkMeetupComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkMeetupComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private broadcastService = inject<BroadcastService<ContentText>>(BroadcastService);
  private changeDetectorRef = inject(ChangeDetectorRef);
  private contentTextService = inject(ContentTextService);
  private notifierService = inject(NotifierService);
  private walkNotificationService = inject(WalkNotificationService);
  public linksService: LinksService = inject(LinksService);
  display = inject(WalkDisplayService);
  meetupService = inject(MeetupService);
  public contentTextItems: ContentText[] = [];
  public notifyTarget: AlertTarget = {};
  protected notify: AlertInstance;
  public walkNotificationData: WalkNotification;
  public config: MeetupConfig;
  meetupEventDescription: string;
  public view: View = View.VIEW;
  protected readonly ContentTextCategory = ContentTextCategory;

  @Input()
  public displayedWalk: DisplayedWalk;

  @Input()
  public saveInProgress: boolean;
  public linkWithSource: LinkWithSource;


  ngOnInit() {
    this.linkWithSource = this.linksService.linkWithSourceFrom(this.displayedWalk?.walk?.fields, LinkSource.MEETUP);
    this.logger.info("ngOnInit:saveInProgress", this.saveInProgress);
    this.logLinkChange();
    this.meetupService.queryConfig().then(config => this.config = config);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.walkNotificationData = this.walkNotificationService.toWalkNotification(this.displayedWalk, this.display.members);
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
      this.linkWithSource.title = contentText.text;
    } else {
      this.logger.debug("Ignoring changed content as category", contentText.category, "not correct");
    }
  }

  canUnlinkMeetup() {
    return this.memberLoginService.allowWalkAdminEdits() && this.displayedWalk?.walk && this.linkWithSource?.href;
  }

  logLinkChange() {
    this.logger.info("links object:", this.linkWithSource, "publishing:", this.displayedWalk?.walk?.fields.publishing, "walk links:", this.displayedWalk?.walk?.fields?.links);
  }
  allowEdits() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk?.walk) || this.memberLoginService.allowWalkAdminEdits();
  }

  changedPublishMeetup($event: any) {
    if ($event && !this.meetupConfigExists()) {
      if (!this.displayedWalk?.walk?.fields.meetup) {
        this.displayedWalk.walk.fields.meetup = this.config;
      }
      this.logger.debug("this.displayedWalk.walk", this.displayedWalk.walk);
    }
  }

  public meetupConfigExists() {
    return has(this.displayedWalk.walk, ["config", "meetup"]);
  }

  public meetupEventDescriptionExists() {
    return this.linkWithSource?.title?.length > 0;
  }

  private createMeetupDescription(data: ContentText) {
    this.linkWithSource.title = `${data.text} [here](${this.display.walkLink(this.displayedWalk.walk)}).\n\n${this.displayedWalk.walk?.groupEvent?.description}`;
    this.meetupEventDescription = this.linkWithSource.title;
    this.logger.debug("meetupEventDescription:", this.meetupEventDescription);
    this.changeDetectorRef.detectChanges();
  }

  inputDisabled(): boolean {
    return false;
  }
}
