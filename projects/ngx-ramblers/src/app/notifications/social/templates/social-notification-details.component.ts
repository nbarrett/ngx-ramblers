import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../../models/committee.model";
import { Member, MemberFilterSelection } from "../../../models/member.model";
import { SocialEvent } from "../../../models/social-events.model";
import { SocialDisplayService } from "../../../pages/social/social-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-social-notification-details",
  template: `
    <div>
      <img *ngIf="socialEvent?.thumbnail" style="width:100%; margin-bottom: 15px"
           [src]="urlService.imageSource(socialEvent?.thumbnail, true)">
      <h3 *ngIf="socialEvent.notification.content.title.include"><strong
        [textContent]="socialEvent.briefDescription"></strong>
      </h3>
      <p [textContent]="socialEvent.notification.content.addresseeType"></p>
      <div *ngIf="socialEvent?.notification?.content?.eventDetails?.include">
        <h4><strong style="font-size:14px">{{ socialEvent.notification.content.eventDetails.value }}</strong></h4>
        <table
          style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
          <tr *ngIf="socialEvent.eventDate">
            <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Date and Time:</td>
            <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
              <span [textContent]="socialEvent.eventDate | displayDate"></span>
              <span style="margin-left: 6px;" [textContent]="socialEvent.eventTimeStart"></span>
            </td>
          </tr>
          <tr *ngIf="socialEvent.postcode || socialEvent.location">
            <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Location:</td>
            <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
              <span [textContent]="socialEvent.location"></span>
              <a style="margin-left: 6px;" [href]="googleMapsService.urlForPostcode(socialEvent.postcode)"
                 target="_blank"><span
                [textContent]="socialEvent.postcode"></span></a></td>
          </tr>
          <tr *ngIf="socialEvent.notification.content.attendees.include">
            <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Attendees:</td>
            <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
                [textContent]="display.attendeeList(socialEvent, memberFilterSelections())"></td>
          </tr>
          <tr *ngIf="socialEvent.eventContactMemberId">
            <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Organiser:</td>
            <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
              <a [href]="'mailto: ' + socialEvent.contactEmail"><span
                [textContent]="socialEvent.displayName || socialEvent.contactEmail"></span></a>
              ({{ socialEvent.contactEmail }})
              <span *ngIf="socialEvent.contactPhone" [textContent]="socialEvent.contactPhone"></span>

            </td>
          </tr>
          <tr *ngIf="socialEvent.notification.content.replyTo.include">
            <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Send email replies to:</td>
            <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
              <a [href]="'mailto: ' + replyTo()?.email"><span
                [textContent]="replyTo()?.fullName"></span></a>
              ({{ replyTo()?.email }})
            </td>
          </tr>
          <tr *ngIf="socialEvent.notification.content.attachment.include && socialEvent.attachment">
            <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Attachment:</td>
            <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
              <a target="_blank" id="attachment"
                 [href]="display.attachmentUrl(socialEvent)"
                 [textContent]="display.attachmentTitle(socialEvent)"></a>
            </td>
          </tr>
          <tr *ngIf="socialEvent?.link">
            <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Venue Link:</td>
            <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
              <a target="_blank" [href]="socialEvent?.link">{{ socialEvent?.linkTitle || socialEvent?.link }}</a></td>
          </tr>
          <tr>
            <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">View Social On Website:</td>
            <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
              <app-link area="social" id="{{socialEvent.id}}" text="click here"></app-link>
            </td>
          </tr>
        </table>
      </div>
      <p *ngIf="socialEvent.notification.content.description.include">
        <span markdown [data]="socialEvent.longerDescription"></span>
      </p>
      <p *ngIf="socialEvent.notification.content.text.include"
         [textContent]="socialEvent.notification.content.text.value"></p>
      <p *ngIf="socialEvent.notification.content.signoffText.include"
         markdown [data]="socialEvent.notification.content.signoffText.value"></p>
    </div>`
})
export class SocialNotificationDetailsComponent implements OnInit {

  @Input()
  public members: Member[];
  @Input()
  public socialEvent: SocialEvent;

  protected logger: Logger;

  constructor(
    public urlService: UrlService,
    public googleMapsService: GoogleMapsService,
    public display: SocialDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialNotificationDetailsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:app-social-notification-details members:", this.members, "socialEvent:", this.socialEvent);
  }

  memberFilterSelections(): MemberFilterSelection[] {
    return this.members.map(member => this.display.toMemberFilterSelection(member));
  }

  replyTo(): CommitteeMember {
    return this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members)?.find(member => this.socialEvent?.notification?.content?.replyTo?.value === member.memberId);
  }
}
