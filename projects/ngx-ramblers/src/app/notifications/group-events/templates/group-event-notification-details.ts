import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember, Notification } from "../../../models/committee.model";
import { Member, MemberFilterSelection } from "../../../models/member.model";
import { GroupEventDisplayService } from "../../../pages/group-events/group-event-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { MailMessagingConfig } from "../../../models/mail.model";
import { CommitteeReferenceDataLike } from "../../../models/committee-reference-data.model";
import { PageService } from "../../../services/page.service";
import { LinkComponent } from "../../../link/link";
import { MarkdownComponent } from "ngx-markdown";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { last } from "es-toolkit/compat";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
    selector: "app-group-event-notification-details",
    template: `
      @if (groupEvent?.groupEvent?.media?.length > 0) {
        <img
          src="{{mediaQueryService.imageSourceWithFallback(groupEvent, true)?.url}}"
          alt="{{mediaQueryService.imageSourceWithFallback(groupEvent, true)?.alt}}"
          style="width:100%;height:auto;display:block"/>
      }
      @if (latestNotification?.content?.title?.include) {
        <h3><strong
          [textContent]="groupEvent?.groupEvent?.title"></strong>
        </h3>
      }
      @if (latestNotification?.content?.eventDetails?.include) {
        <div>
          <h4>{{ latestNotification?.content?.eventDetails.value }}</h4>
          <table
            style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
            @if (groupEvent?.groupEvent?.start_date_time) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Date and Time:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <span [textContent]="groupEvent?.groupEvent?.start_date_time | displayDate"></span>
                  <span style="margin-left: 6px;" [textContent]="groupEvent?.groupEvent?.start_date_time"></span>
                </td>
              </tr>
            }
            @if (groupEvent?.groupEvent?.location.postcode || groupEvent?.groupEvent?.location.description) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Location:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <span [textContent]="groupEvent?.groupEvent?.location.description"></span>
                  <a style="margin-left: 6px;"
                     [href]="googleMapsService.urlForPostcode(groupEvent?.groupEvent?.location.postcode)"
                     target="_blank"><span
                    [textContent]="groupEvent?.groupEvent?.location.postcode"></span></a></td>
              </tr>
            }
            @if (latestNotification?.content?.attendees.include) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Attendees:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
                    [textContent]="display.attendeeList(groupEvent, memberFilterSelections())"></td>
              </tr>
            }
            @if (groupEvent?.fields?.contactDetails?.memberId) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Organiser:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <a [href]="'mailto: ' + groupEvent?.fields?.contactDetails?.email"><span
                    [textContent]="groupEvent?.fields?.contactDetails?.displayName || groupEvent?.fields?.contactDetails?.email"></span></a>
                  ({{ groupEvent?.fields?.contactDetails?.email }})
                  @if (groupEvent?.fields?.contactDetails?.phone) {
                    <span [textContent]="groupEvent?.fields?.contactDetails?.phone"></span>
                  }
                </td>
              </tr>
            }
            @if (latestNotification?.content?.replyTo.include) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Send email replies to:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <a [href]="'mailto: ' + replyTo()?.email">{{ replyTo()?.fullName }}</a> ({{ replyTo()?.email }})
                </td>
              </tr>
            }
            @if (latestNotification?.content?.attachment.include && groupEvent.fields.attachment) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Attachment:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <a target="_blank" id="attachment"
                     [href]="display.attachmentUrl(groupEvent)"
                     [textContent]="display.attachmentTitle(groupEvent)"></a>
                </td>
              </tr>
            }
            @for (link of groupEvent.fields.links; track link.href) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Venue Link:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <a target="_blank" [href]="link.href">{{ link.title }}</a>
                </td>
              </tr>
            }
            <tr>
              <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">View Event On Website:</td>
              <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                <app-link [area]="pageService.groupEventPage()?.href" id="{{stringUtils.lastItemFrom(groupEvent?.groupEvent?.url)}}" text="click here"></app-link>
              </td>
            </tr>
          </table>
        </div>
      }
      @if (latestNotification?.content?.description.include) {
        <p>
          <span markdown [data]="groupEvent?.groupEvent?.description"></span>
        </p>
      }
      @if (latestNotification?.content?.text.include) {
        <p
          [textContent]="latestNotification?.content?.text.value"></p>
      }
      @if (latestNotification?.content?.signoffText.include) {
        <p
          markdown [data]="latestNotification?.content?.signoffText.value"></p>
      }
      @if (latestNotification?.content?.signoffAs.include) {
        <app-contact-us
          [committeeReferenceDataOverride]="committeeReferenceDataSource()"
          [format]="'list'"
          [roles]="latestNotification?.content?.signoffAs?.value"/>
      }`,
    imports: [LinkComponent, MarkdownComponent, ContactUsComponent, DisplayDatePipe]
})
export class GroupEventNotificationDetails implements OnInit {
  public mediaQueryService: MediaQueryService = inject(MediaQueryService);
  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventNotificationDetails", NgxLoggerLevel.ERROR);
  protected pageService = inject(PageService);
  protected urlService = inject(UrlService);
  protected stringUtils = inject(StringUtilsService);
  protected googleMapsService = inject(GoogleMapsService);
  protected display = inject(GroupEventDisplayService);

  @Input({ required: true })
  public members: Member[];
  @Input({ required: true })
  public groupEvent: ExtendedGroupEvent;
  @Input({ required: true })
  public mailMessagingConfig: MailMessagingConfig;
  public latestNotification: Notification;

  ngOnInit() {
    this.logger.debug("ngOnInit:app-group-event-notification-details members:", this.members, "groupEvent:", this.groupEvent);
    this.latestNotification = last(this.groupEvent?.fields.notifications);
  }

  committeeReferenceDataSource(): CommitteeReferenceDataLike {
    return this.mailMessagingConfig.committeeReferenceData.createFrom(this.display?.committeeMembersPlusOrganiser(this.groupEvent, this.members));
  }

  public memberFilterSelections(): MemberFilterSelection[] {
    return this.members.map(member => this.display.toMemberFilterSelection(member));
  }

  public replyTo(): CommitteeMember {
    const committeeMember = this.display?.committeeMembersPlusOrganiser(this.groupEvent, this.members)?.find(member => this.latestNotification?.content?.replyTo?.value === member.type);
    this.logger.info("replyTo:committeeMember:", committeeMember);
    return committeeMember;
  }
}
