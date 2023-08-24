import { Component, OnInit } from "@angular/core";
import { faAdd, faClose } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { CommitteeConfig, CommitteeFileType, Notification } from "../../../../models/committee.model";
import { sortBy } from "../../../../services/arrays";
import { CommitteeConfigService } from "../../../../services/committee-config.service";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { ContentMetadataService } from "../../../../services/content-metadata.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MemberLoginService } from "../../../../services/member/member-login.service";
import { MemberService } from "../../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";

@Component({
  selector: "app-committee-settings",
  templateUrl: "./committee-settings.html",
})
export class CommitteeSettingsComponent implements OnInit {

  constructor(private contentMetadataService: ContentMetadataService,
              private committeeQueryService: CommitteeQueryService,
              private notifierService: NotifierService,
              public stringUtils: StringUtilsService,
              private urlService: UrlService,
              private memberService: MemberService,
              private memberLoginService: MemberLoginService,
              private committeeConfigService: CommitteeConfigService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeSettingsComponent, NgxLoggerLevel.OFF);
  }

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  private logger: Logger;
  public committeeConfig: CommitteeConfig;
  protected readonly faClose = faClose;
  protected readonly faAdd = faAdd;

  ngOnInit() {
    this.committeeConfigService.getConfig()
      .then(committeeConfig => {
        this.committeeConfig = committeeConfig;
        this.logger.info("retrieved committeeConfig", committeeConfig);
      }).catch(error => this.notify.error({title: "Failed to query Committee config", message: error}));

  }

  save() {
    this.logger.debug("saving config", this.committeeConfig);
    this.committeeConfig.fileTypes = this.committeeConfig.fileTypes.sort(sortBy("description"));
    this.committeeConfigService.saveConfig(this.committeeConfig)
      .then(() => this.urlService.navigateTo("admin"))
      .catch((error) => this.notify.error(error));
  }

  cancel() {
    this.urlService.navigateTo("admin");
  }

  notReady() {
    return !this.committeeConfig;
  }

  deleteFileType(fileType: CommitteeFileType) {
    this.committeeConfig.fileTypes = this.committeeConfig.fileTypes.filter(item => item !== fileType);
  }

  addFileType() {
    this.committeeConfig.fileTypes.push({description: "(Enter new file type)"});
  }
}
