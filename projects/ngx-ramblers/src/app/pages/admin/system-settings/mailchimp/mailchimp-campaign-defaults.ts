import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../../../models/committee.model";
import { MailchimpCampaignDefaults } from "../../../../models/mailchimp.model";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../../../services/committee/committee-reference-data";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../../services/mailchimp-config.service";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-mailchimp-campaign-defaults",
    templateUrl: "./mailchimp-campaign-defaults.html",
    imports: [FormsModule]
})
export class MailchimpCampaignDefaultsComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpCampaignDefaultsComponent", NgxLoggerLevel.ERROR);
  private committeeConfigService = inject(CommitteeConfigService);
  private mailchimpConfigService = inject(MailchimpConfigService);
  public committeeReferenceData: CommitteeReferenceData;
  public committeeMember: CommitteeMember;
  @Input()
  campaignDefaults: MailchimpCampaignDefaults;

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
