import { ChangeDetectorRef, Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommitteeMember } from "../../../models/committee.model";
import { Member, MemberFilterSelection } from "../../../models/member.model";
import { SocialEvent } from "../../../models/social-events.model";
import { SocialDisplayService } from "../../../pages/social/social-display.service";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../../services/committee/committee-reference-data";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-social-notification-details",
  templateUrl: "./social-notification-details.component.html"
})
export class SocialNotificationDetailsComponent implements OnInit {

  @Input()
  public members: Member[];
  @Input()
  public socialEvent: SocialEvent;

  protected logger: Logger;
  private committeeReferenceData: CommitteeReferenceData;
  private dataSub: Subscription;

  constructor(
    public urlService: UrlService,
    public googleMapsService: GoogleMapsService,
    private changeDetectorRef: ChangeDetectorRef,
    private committeeConfig: CommitteeConfigService,
    public display: SocialDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialNotificationDetailsComponent, NgxLoggerLevel.OFF);
  }

  memberFilterSelections(): MemberFilterSelection[] {
    return this.members.map(member => this.display.toMemberFilterSelection(member));
  }

  ngOnInit() {
    this.dataSub = this.committeeConfig.events().subscribe(data => this.committeeReferenceData = data);
    this.logger.debug("ngOnInit:app-social-notification-details members:", this.members, "socialEvent:", this.socialEvent);
  }

  replyTo(): CommitteeMember {
    return this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members)?.find(member => this.socialEvent?.notification?.content?.replyTo?.value === member.memberId);
  }

  committeeReferenceDataSource(): CommitteeReferenceData {
    return this.committeeReferenceData.createFrom(this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members))
  }

  signoffAs(): CommitteeMember {
    const signoffAs = this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members)?.find(member => this.socialEvent?.notification?.content?.signoffAs?.value === member.memberId);
    this.logger.info("signoffAs:", this.members, signoffAs);
    return signoffAs;
  }
}
