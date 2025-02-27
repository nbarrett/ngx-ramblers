import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { CommitteeMember } from "../../models/committee.model";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import first from "lodash-es/first";
import { NgStyle } from "@angular/common";

@Component({
    selector: "app-contact-us",
    template: `
    @if (format==='list') {
      <ul>
        @for (committeeMember of committeeMembers(); track committeeMember) {
          <li
          [ngStyle]="{
          'font-weight': 'normal',
          'background-image': 'url('+ urlService.baseUrl() + '/assets/images/ramblers/icons/ramblers_icon_2_arrow_forward_rgb.png)',
          'padding': '3px 0px 9px 24px',
          'list-style': 'none outside',
          'background-repeat': 'no-repeat',
          'background-position': '0px 7px',
          'background-size': '18px'}">
            {{ committeeMember.fullName }} - {{ committeeMember.description }} -
            <a [href]="'mailto:' + committeeMember.email"
              [ngStyle]="emailStyle?{'color': '#c05711', 'font-weight': 'normal', 'text-decoration': 'underline'}:null">
              {{ committeeMember.email }}
            </a>
          </li>
        }
      </ul>
    }
    @if (format!=='list') {
      <a [href]="'mailto:' + email()">{{ text || email() }}</a>
    }
    `,
    styleUrls: ["./contact-us.sass"],
    imports: [NgStyle]
})

export class ContactUsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("ContactUsComponent", NgxLoggerLevel.ERROR);
  urlService = inject(UrlService);
  private committeeConfig = inject(CommitteeConfigService);

  @Input() format: string;
  @Input() emailStyle: boolean;
  @Input() text: string;
  @Input() roles: string[] | string;
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

  committeeMembers(): CommitteeMember[] {
    const committeeMembers = this.roles ? this.committeeReferenceDataSource()?.committeeMembersForRole(this.roles) : this.committeeReferenceDataSource()?.committeeMembers();
    this.logger.info("committeeMembers:roles:", this.roles,"committeeMembers:", committeeMembers);
    return committeeMembers;
  }

  email() {
    return this.committeeReferenceDataSource()?.contactUsField(first(this.committeeReferenceData.toRoles(this.roles)), "email");
  }

}
