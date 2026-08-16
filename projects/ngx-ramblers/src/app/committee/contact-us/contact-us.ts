import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommitteeMember } from "../../models/committee.model";
import { committeeMemberTrackKey } from "../../functions/committee-members";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import { NgStyle } from "@angular/common";
import { ContactUsModalService } from "../../pages/contact-us/contact-us-modal.service";

export const MEMBERSHIP_CONTACT_ROLE_PREFERENCE = "membership,secretary,contact-us";

@Component({
    selector: "app-contact-us",
    template: `
    @if (format==='list') {
      <ul>
        @for (committeeMember of committeeMembers(); track committeeMemberTrackKey(committeeMember)) {
          <li
          [ngStyle]="{
          'font-weight': 'normal',
          'background-image': 'url('+ urlService.publicBaseUrl() + '/assets/images/ramblers/icons/ramblers_icon_2_arrow_forward_rgb.png)',
          'padding': '3px 0px 9px 24px',
          'list-style': 'none outside',
          'background-repeat': 'no-repeat',
          'background-position': '0px 7px',
          'background-size': '18px'}">
            {{ nameAndRole(committeeMember) }} -
            <a [href]="'mailto:' + committeeMember.email"
              [ngStyle]="emailStyle?{'color': '#c05711', 'font-weight': 'normal', 'text-decoration': 'underline'}:null">
              {{ committeeMember.email }}
            </a>
          </li>
        }
      </ul>
    }
    @if (format!=='list' && resolvedMember()) {
      <a href="#" class="contact-us-link" (click)="openContact($event)">{{ displayText() }}</a>
    }
    `,
    styleUrls: ["./contact-us.sass"],
    imports: [NgStyle]
})

export class ContactUsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("ContactUsComponent", NgxLoggerLevel.ERROR);
  protected readonly committeeMemberTrackKey = committeeMemberTrackKey;
  urlService = inject(UrlService);
  private committeeConfig = inject(CommitteeConfigService);
  private contactUsModalService = inject(ContactUsModalService);

  @Input() format: string;
  @Input() emailStyle: boolean;
  @Input() text: string;
  @Input() roles: string[] | string = MEMBERSHIP_CONTACT_ROLE_PREFERENCE;
  @Input() subject: string;
  @Input() committeeReferenceDataOverride: CommitteeReferenceData;
  private dataSub: Subscription;
  private committeeReferenceData: CommitteeReferenceData;

  ngOnInit() {
    this.dataSub = this.committeeConfig.committeeReferenceDataEvents().subscribe(data => this.committeeReferenceData = data);
    this.logger.info("format:", this.format, "roles:", this.roles, "text:", this.text);
  }

  ngOnDestroy() {
    if (this.dataSub) {
      this.dataSub.unsubscribe();
    }
  }

  committeeReferenceDataSource() {
    return this.committeeReferenceDataOverride || this.committeeReferenceData;
  }

  nameAndRole(committeeMember: CommitteeMember): string {
    return committeeMember.description && committeeMember.description !== committeeMember.fullName
      ? `${committeeMember.fullName} - ${committeeMember.description}`
      : committeeMember.fullName;
  }

  committeeMembers(): CommitteeMember[] {
    const committeeMembers = this.roles
      ? this.committeeReferenceDataSource()?.committeeMembersForRole(this.roles)
      : this.committeeReferenceDataSource()?.committeeMembers();
    this.logger.info("committeeMembers:roles:", this.roles, "committeeMembers:", committeeMembers);
    return committeeMembers;
  }

  resolvedMember(): CommitteeMember | undefined {
    return this.committeeReferenceDataSource()?.committeeMemberForPreferredRoles(this.roles);
  }

  displayText(): string {
    const member = this.resolvedMember();
    if (!member) {
      return this.text || "the committee";
    }
    return this.committeeReferenceDataSource()?.contactDisplayName(member) || this.text || "the committee";
  }

  email(): string {
    return this.resolvedMember()?.email;
  }

  openContact(event: Event): void {
    event.preventDefault();
    const member = this.resolvedMember();
    if (!member?.type) {
      return;
    }
    this.contactUsModalService.openContactModalForRole(member.type, this.subject || "", this.urlService.relativeUrl());
  }

}
