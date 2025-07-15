import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember, Notification } from "../../../models/committee.model";
import { Member, MemberFilterSelection } from "../../../models/member.model";
import { SocialDisplayService } from "../../../pages/social/social-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { CommitteeReferenceData } from "../../../services/committee/committee-reference-data";
import { MailMessagingConfig } from "../../../models/mail.model";
import { PageService } from "../../../services/page.service";
import { LinkComponent } from "../../../link/link";
import { MarkdownComponent } from "ngx-markdown";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import last from "lodash-es/last";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
    selector: "app-social-notification-details",
    template: `
      @if (socialEvent?.groupEvent?.media?.length > 0) {
        <img
          src="{{mediaQueryService.imageSourceWithFallback(socialEvent)?.url}}"
          alt="{{mediaQueryService.imageSourceWithFallback(socialEvent)?.alt}}" height="150"
          class="card-img-top"/>
      }
      @if (latestNotification?.content?.title?.include) {
        <h3><strong
          [textContent]="socialEvent?.groupEvent?.title"></strong>
        </h3>
      }
      <p [textContent]="latestNotification?.content?.addresseeType"></p>
      @if (latestNotification?.content?.eventDetails?.include) {
        <div>
          <h4><strong style="font-size:14px">{{ latestNotification?.content?.eventDetails.value }}</strong></h4>
          <table
            style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
            @if (socialEvent?.groupEvent?.start_date_time) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Date and Time:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <span [textContent]="socialEvent?.groupEvent?.start_date_time | displayDate"></span>
                  <span style="margin-left: 6px;" [textContent]="socialEvent?.groupEvent?.start_date_time"></span>
                </td>
              </tr>
            }
            @if (socialEvent?.groupEvent?.location.postcode || socialEvent?.groupEvent?.location.description) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Location:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <span [textContent]="socialEvent?.groupEvent?.location.description"></span>
                  <a style="margin-left: 6px;"
                     [href]="googleMapsService.urlForPostcode(socialEvent?.groupEvent?.location.postcode)"
                     target="_blank"><span
                    [textContent]="socialEvent?.groupEvent?.location.postcode"></span></a></td>
              </tr>
            }
            @if (latestNotification?.content?.attendees.include) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Attendees:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
                    [textContent]="display.attendeeList(socialEvent, memberFilterSelections())"></td>
              </tr>
            }
            @if (socialEvent?.fields?.contactDetails?.memberId) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Organiser:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <a [href]="'mailto: ' + socialEvent?.fields?.contactDetails?.email"><span
                    [textContent]="socialEvent?.fields?.contactDetails?.displayName || socialEvent?.fields?.contactDetails?.email"></span></a>
                  ({{ socialEvent?.fields?.contactDetails?.email }})
                  @if (socialEvent?.fields?.contactDetails?.phone) {
                    <span [textContent]="socialEvent?.fields?.contactDetails?.phone"></span>
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
            @if (latestNotification?.content?.attachment.include && socialEvent.fields.attachment) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Attachment:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <a target="_blank" id="attachment"
                     [href]="display.attachmentUrl(socialEvent)"
                     [textContent]="display.attachmentTitle(socialEvent)"></a>
                </td>
              </tr>
            }
            @for (link of socialEvent.fields.links; track link.href) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Venue Link:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <a target="_blank" [href]="link.href">{{ link.title }}</a>
                </td>
              </tr>
            }
            <tr>
              <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">View Social On Website:</td>
              <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                <app-link [area]="pageService.socialPage()?.href" id="{{stringUtils.lastItemFrom(socialEvent?.groupEvent?.url)}}" text="click here"></app-link>
              </td>
            </tr>
          </table>
        </div>
      }
      @if (latestNotification?.content?.description.include) {
        <p>
          <span markdown [data]="socialEvent?.groupEvent?.description"></span>
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
export class SocialNotificationDetailsComponent implements OnInit {
  public mediaQueryService: MediaQueryService = inject(MediaQueryService);
  private logger: Logger = inject(LoggerFactory).createLogger("SocialNotificationDetailsComponent", NgxLoggerLevel.ERROR);
  protected pageService = inject(PageService);
  protected urlService = inject(UrlService);
  protected stringUtils = inject(StringUtilsService);
  protected googleMapsService = inject(GoogleMapsService);
  protected display = inject(SocialDisplayService);

  @Input({ required: true })
  public members: Member[];
  @Input({ required: true })
  public socialEvent: ExtendedGroupEvent;
  @Input({ required: true })
  public mailMessagingConfig: MailMessagingConfig;
  public latestNotification: Notification;

  ngOnInit() {
    this.logger.debug("ngOnInit:app-social-notification-details members:", this.members, "socialEvent:", this.socialEvent);
    this.latestNotification = last(this.socialEvent?.fields.notifications);
  }

  committeeReferenceDataSource(): CommitteeReferenceData {
    return this.mailMessagingConfig.committeeReferenceData.createFrom(this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members));
  }

  public memberFilterSelections(): MemberFilterSelection[] {
    return this.members.map(member => this.display.toMemberFilterSelection(member));
  }

  public replyTo(): CommitteeMember {
    const committeeMember = this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members)?.find(member => this.latestNotification?.content?.replyTo?.value === member.type);
    this.logger.info("replyTo:committeeMember:", committeeMember);
    return committeeMember;
  }
}
