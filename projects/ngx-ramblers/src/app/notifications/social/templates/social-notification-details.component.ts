import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../../models/committee.model";
import { Member, MemberFilterSelection } from "../../../models/member.model";
import { SocialEvent } from "../../../models/social-events.model";
import { SocialDisplayService } from "../../../pages/social/social-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { CommitteeReferenceData } from "../../../services/committee/committee-reference-data";
import { MailMessagingConfig } from "../../../models/mail.model";
import { PageService } from "../../../services/page.service";

@Component({
  selector: "app-social-notification-details",
  template: `
      @if (socialEvent?.thumbnail) {
        <img style="width:100%; margin-bottom: 15px"
          [src]="urlService.imageSource(socialEvent?.thumbnail, true)">
      }
      @if (socialEvent.notification.content.title.include) {
        <h3><strong
        [textContent]="socialEvent.briefDescription"></strong>
      </h3>
      }
      <p [textContent]="socialEvent.notification.content.addresseeType"></p>
      @if (socialEvent?.notification?.content?.eventDetails?.include) {
        <div>
          <h4><strong style="font-size:14px">{{ socialEvent.notification.content.eventDetails.value }}</strong></h4>
          <table
            style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
            @if (socialEvent.eventDate) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Date and Time:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <span [textContent]="socialEvent.eventDate | displayDate"></span>
                  <span style="margin-left: 6px;" [textContent]="socialEvent.eventTimeStart"></span>
                </td>
              </tr>
            }
            @if (socialEvent.postcode || socialEvent.location) {
              <tr>
                <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Location:</td>
                <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                  <span [textContent]="socialEvent.location"></span>
                  <a style="margin-left: 6px;" [href]="googleMapsService.urlForPostcode(socialEvent.postcode)"
                    target="_blank"><span
                  [textContent]="socialEvent.postcode"></span></a></td>
                </tr>
              }
              @if (socialEvent.notification.content.attendees.include) {
                <tr>
                  <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Attendees:</td>
                  <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
                  [textContent]="display.attendeeList(socialEvent, memberFilterSelections())"></td>
                </tr>
              }
              @if (socialEvent.eventContactMemberId) {
                <tr>
                  <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Organiser:</td>
                  <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                    <a [href]="'mailto: ' + socialEvent.contactEmail"><span
                    [textContent]="socialEvent.displayName || socialEvent.contactEmail"></span></a>
                    ({{ socialEvent.contactEmail }})
                    @if (socialEvent.contactPhone) {
                      <span [textContent]="socialEvent.contactPhone"></span>
                    }
                  </td>
                </tr>
              }
              @if (socialEvent.notification.content.replyTo.include) {
                <tr>
                  <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Send email replies to:</td>
                  <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                    <a [href]="'mailto: ' + replyTo()?.email">{{ replyTo()?.fullName }}</a> ({{ replyTo()?.email }})
                  </td>
                </tr>
              }
              @if (socialEvent.notification.content.attachment.include && socialEvent.attachment) {
                <tr>
                  <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Attachment:</td>
                  <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                    <a target="_blank" id="attachment"
                      [href]="display.attachmentUrl(socialEvent)"
                    [textContent]="display.attachmentTitle(socialEvent)"></a>
                  </td>
                </tr>
              }
              @if (socialEvent?.link) {
                <tr>
                  <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Venue Link:</td>
                  <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                    <a target="_blank" [href]="socialEvent?.link">{{ socialEvent?.linkTitle || socialEvent?.link }}</a></td>
                  </tr>
                }
                <tr>
                  <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">View Social On Website:</td>
                  <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
                    <app-link [area]="pageService.socialPage()?.href" id="{{socialEvent.id}}" text="click here"></app-link>
                  </td>
                </tr>
              </table>
            </div>
          }
          @if (socialEvent.notification.content.description.include) {
            <p>
              <span markdown [data]="socialEvent.longerDescription"></span>
            </p>
          }
          @if (socialEvent.notification.content.text.include) {
            <p
            [textContent]="socialEvent.notification.content.text.value"></p>
          }
          @if (socialEvent.notification.content.signoffText.include) {
            <p
            markdown [data]="socialEvent.notification.content.signoffText.value"></p>
          }
          @if (socialEvent.notification.content.signoffAs.include) {
            <app-contact-us
              [committeeReferenceDataOverride]="committeeReferenceDataSource()"
              [format]="'list'"
              [roles]="socialEvent?.notification?.content?.signoffAs?.value"/>
          }`,
  standalone: false
})
export class SocialNotificationDetailsComponent implements OnInit {

  @Input({ required: true })
  public members: Member[];
  @Input({ required: true })
  public socialEvent: SocialEvent;
  @Input({ required: true })
  public mailMessagingConfig: MailMessagingConfig;

  protected logger: Logger;

  constructor(
    protected pageService: PageService,
    public urlService: UrlService,
    public googleMapsService: GoogleMapsService,
    public display: SocialDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialNotificationDetailsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:app-social-notification-details members:", this.members, "socialEvent:", this.socialEvent);
  }

  committeeReferenceDataSource(): CommitteeReferenceData {
    return this.mailMessagingConfig.committeeReferenceData.createFrom(this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members));
  }

  public memberFilterSelections(): MemberFilterSelection[] {
    return this.members.map(member => this.display.toMemberFilterSelection(member));
  }

  public replyTo(): CommitteeMember {
    const committeeMember = this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members)?.find(member => this.socialEvent?.notification?.content?.replyTo?.value === member.type);
    this.logger.info("replyTo:committeeMember:", committeeMember);
    return committeeMember;
  }
}
