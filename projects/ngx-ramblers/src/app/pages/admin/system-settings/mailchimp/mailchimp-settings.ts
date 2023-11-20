import { Component, OnDestroy, OnInit } from "@angular/core";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { NamedEventType } from "../../../../models/broadcast.model";
import {
  MailchimpCampaignListResponse,
  MailchimpConfig,
  MailchimpListingResponse
} from "../../../../models/mailchimp.model";
import { FullNameWithAliasPipe } from "../../../../pipes/full-name-with-alias.pipe";
import { LineFeedsToBreaksPipe } from "../../../../pipes/line-feeds-to-breaks.pipe";
import { BroadcastService } from "../../../../services/broadcast-service";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { ContentMetadataService } from "../../../../services/content-metadata.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../../services/mailchimp-config.service";
import { MailchimpCampaignService } from "../../../../services/mailchimp/mailchimp-campaign.service";
import { MailchimpLinkService } from "../../../../services/mailchimp/mailchimp-link.service";
import { MailchimpSegmentService } from "../../../../services/mailchimp/mailchimp-segment.service";
import { MemberLoginService } from "../../../../services/member/member-login.service";
import { MemberService } from "../../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { Organisation } from "../../../../models/system.model";
import { Subscription } from "rxjs";
import { MailchimpListService } from "../../../../services/mailchimp/mailchimp-list.service";

@Component({
  selector: "app-mailchimp-settings",
  templateUrl: "./mailchimp-settings.html",
})
export class MailchimpSettingsComponent implements OnInit, OnDestroy {

  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public mailchimpCampaignListResponse: MailchimpCampaignListResponse;
  public campaignSearchTerm: string;
  public mailchimpConfig: MailchimpConfig;
  public mailchimpListingResponse: MailchimpListingResponse;
  public group: Organisation;
  private subscriptions: Subscription[] = [];

  constructor(private contentMetadataService: ContentMetadataService,
              private mailchimpSegmentService: MailchimpSegmentService,
              private mailchimpCampaignService: MailchimpCampaignService,
              private mailchimpConfigService: MailchimpConfigService,
              private systemConfigService: SystemConfigService,
              private notifierService: NotifierService,
              private stringUtils: StringUtilsService,
              private committeeConfig: CommitteeConfigService,
              private memberService: MemberService,
              private fullNameWithAlias: FullNameWithAliasPipe,
              private lineFeedsToBreaks: LineFeedsToBreaksPipe,
              private modalService: BsModalService,
              private mailchimpLinkService: MailchimpLinkService,
              private memberLoginService: MemberLoginService,
              private mailchimpListService: MailchimpListService,
              private broadcastService: BroadcastService<any>,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MailchimpSettingsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.campaignSearchTerm = "Master";
    this.notify.setBusy();
    this.notify.progress({
      title: "Mailchimp Campaigns",
      message: "Getting campaign information matching " + this.campaignSearchTerm
    });
    this.mailchimpConfigService.getConfig()
      .then(mailchimpConfig => {
        this.mailchimpConfig = mailchimpConfig;
        this.logger.info("retrieved mailchimpConfig (pre-validation)", this.mailchimpConfig);
        if (!this.mailchimpConfig.campaignDefaults) {
          this.mailchimpConfigService.setCampaignDefaults(this.mailchimpConfig);
        }
        if (!this.mailchimpConfig.lists) {
          this.mailchimpConfig.lists = {};
        }
        if (!this.mailchimpConfig?.segments?.general) {
          this.mailchimpConfig.segments = {general: this.mailchimpConfigService.SegmentDefaults};
        }
        this.logger.info("retrieved mailchimpConfig (post-validation)", this.mailchimpConfig);
        if (this.mailchimpConfig?.mailchimpEnabled) {
          this.refreshMailchimpCampaigns();
          this.refreshMailchimpLists();
        } else {
          this.notifyMailchimpIntegrationNotEnabled();
        }
      })
      .catch(error => this.notify.error({title: "Failed to query Mailchimp config", message: error}));
    this.broadcastService.on(NamedEventType.MAILCHIMP_LISTS_CHANGED, () => {
      this.logger.info("event received:", NamedEventType.MAILCHIMP_LISTS_CHANGED);
      if (this.mailchimpConfig?.mailchimpEnabled) {
        this.refreshMailchimpLists().then(() => this.notify.hide());
      } else {
        this.notifyMailchimpIntegrationNotEnabled();
      }
    });
    this.broadcastService.on(NamedEventType.ERROR, (error) => {
      this.logger.info("event received:", NamedEventType.ERROR);
      this.notify.error({title: "Unexpected Error Occurred", message: error});
    });
  }

  private notifyMailchimpIntegrationNotEnabled() {
    this.notify.warning({
      title: "Mailchimp Integration not enabled",
      message: "List and campaign dropdowns will not be populated"
    });
  }

  private refreshMailchimpCampaigns() {
    this.mailchimpCampaignService.list({
      concise: true,
      limit: 1000,
      start: 0,
      status: "save",
      query: this.campaignSearchTerm
    }).then((mailchimpCampaignListResponse: MailchimpCampaignListResponse) => {
      this.mailchimpCampaignListResponse = mailchimpCampaignListResponse;
      this.logger.debug("mailchimpCampaignService list mailchimpCampaignListResponse:", mailchimpCampaignListResponse);
      this.notify.success({
        title: "Mailchimp Campaigns",
        message: "Found " + this.mailchimpCampaignListResponse.campaigns.length + " draft campaigns matching " + this.campaignSearchTerm
      });
      this.notify.clearBusy();
    }).catch(error => this.notify.error({title: "Failed to query Mailchimp config", message: error}));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshMailchimpLists(): Promise<void> {
    return this.mailchimpListService.lists(this.notify).then((response: MailchimpListingResponse) => {
      this.mailchimpListingResponse = response;
      this.logger.debug("mailchimpListService lists response:", response);
    });
  }

  notReady() {
    if (this.mailchimpConfig && !this.mailchimpConfig.mailchimpEnabled) {
      return false;
    } else {
      return !this.mailchimpCampaignListResponse;
    }
  }

  editCampaign(campaignId) {
    if (this.mailchimpConfig?.mailchimpEnabled) {
      if (!campaignId) {
        this.notify.error({
          title: "Edit Mailchimp Campaign",
          message: "Please select a campaign from the drop-down before choosing edit"
        });
      } else {
        this.notify.hide();
        const webId = this.mailchimpCampaignListResponse.campaigns.find(campaign => campaign.id === campaignId).web_id;
        this.logger.debug("editCampaign:campaignId", campaignId, "web_id", webId);
        return window.open(`${this.mailchimpLinkService.campaignEdit(webId)}`, "_blank");
      }
    } else {
      this.notifyMailchimpIntegrationNotEnabled();
    }
  }

  save() {
    this.logger.debug("saving config", this.mailchimpConfig);
    this.mailchimpConfigService.saveConfig(this.mailchimpConfig)
      .then(() => this.urlService.navigateTo(["admin"]))
      .catch((error) => this.notify.error(error));
  }

  cancel() {
    this.urlService.navigateTo(["admin"]);
  }

}
