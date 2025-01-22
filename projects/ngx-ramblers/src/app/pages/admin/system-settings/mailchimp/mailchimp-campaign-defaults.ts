import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../../../models/committee.model";
import { MailchimpCampaignDefaults } from "../../../../models/mailchimp.model";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../../../services/committee/committee-reference-data";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../../services/mailchimp-config.service";

@Component({
  selector: "app-mailchimp-campaign-defaults",
  templateUrl: "./mailchimp-campaign-defaults.html",
  standalone: false
})
export class MailchimpCampaignDefaultsComponent implements OnInit {

  private logger: Logger;
  public committeeReferenceData: CommitteeReferenceData;
  public committeeMember: CommitteeMember;

  @Input()
  campaignDefaults: MailchimpCampaignDefaults;

  constructor(private committeeConfigService: CommitteeConfigService,
              private mailchimpConfigService: MailchimpConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailchimpSettingsContactComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.committeeConfigService.committeeReferenceDataEvents().subscribe(data => {
      this.committeeReferenceData = data;
      this.setDefaultCommitteeMember();
    });
  }

  setCampaignDefaultsFields(member: CommitteeMember) {
    this.campaignDefaults.from_name = member.fullName;
    this.campaignDefaults.from_email = member.email;
  }

  private setDefaultCommitteeMember() {
    this.committeeMember = this.committeeReferenceData?.committeeMembers()?.find(item => item.email === this.campaignDefaults?.from_email);
    this.logger.debug("committeeMember:", this.committeeMember, "this.committeeReferenceData:", this.committeeReferenceData, "this.mailchimpConfigService.campaignDefaults:", this.mailchimpConfigService.campaignDefaults);
  }

  notReady() {
    return !this.committeeReferenceData;
  }
}
