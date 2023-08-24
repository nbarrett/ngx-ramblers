import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import last from "lodash-es/last";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { CommitteeFile, CommitteeYear, committeeYearsPath } from "../../../models/committee.model";
import { PageContent, PageContentColumn, PageContentRow } from "../../../models/content-text.model";
import { LoginResponse } from "../../../models/member.model";
import { ConfirmType } from "../../../models/ui-actions";
import { ApiResponseProcessor } from "../../../services/api-response-processor.service";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { PageContentService } from "../../../services/page-content.service";
import { UrlService } from "../../../services/url.service";
import { CommitteeDisplayService } from "../committee-display.service";
import { CommitteeEditFileModalComponent } from "../edit/committee-edit-file-modal.component";

@Component({
  selector: "app-committee-year",
  templateUrl: "./committee-year.html",
  styleUrls: ["./committee-year.sass"],
  changeDetection: ChangeDetectionStrategy.Default
})
export class CommitteeYearComponent implements OnInit, OnDestroy {

  @Input()
  public notify: AlertInstance;
  public filesForYear: CommitteeFile[];

  @Input("committeeYear") set acceptChangesFrom(committeeYear: CommitteeYear) {
    this.logger.debug("committeeYear:input", committeeYear);
    this.committeeYear = committeeYear;
    this.setupDataForYear();
  }

  public committeeYear: CommitteeYear;
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  public committeeFile: CommitteeFile;
  public committeeYearTitle = "";
  public imageSource: string;

  constructor(
    public memberLoginService: MemberLoginService,
    private notifierService: NotifierService,
    private apiResponseProcessor: ApiResponseProcessor,
    public display: CommitteeDisplayService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private modalService: BsModalService,
    public pageContentService: PageContentService,
    public actions: PageContentActionsService,
    public committeeQueryService: CommitteeQueryService,
    private committeeFileService: CommitteeFileService,
    public urlService: UrlService,
    private changeDetectorRef: ChangeDetectorRef,
    private committeeConfig: CommitteeConfigService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeYearComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:committeeYear", this.committeeYear);
    this.committeeQueryService.queryAllFiles().then(() => this.setupDataForYear());
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.committeeQueryService.queryAllFiles();
    }));
    this.subscriptions.push(this.committeeFileService.notifications().subscribe(apiResponse => {
      if (apiResponse.error) {
        this.logger.warn("received error:", apiResponse.error);
      } else {
        this.filesForYear = this.apiResponseProcessor.processResponse(this.logger, this.filesForYear, apiResponse);
      }
    }));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const year = paramMap.get("year");
      this.logger.debug("year from route params:", paramMap, year);
      if (year) {
        const committeeYear = {year: +year, latestYear: false};
        this.logger.debug("committeeYear:", committeeYear);
        this.committeeYear = committeeYear;
      }
      this.setupDataForYear();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private async setupDataForYear(): Promise<void> {
    this.logger.info("committeeYear:", this.committeeYear, "committeeYearTitle:", this.committeeYearTitle);
    this.committeeYearTitle = this.committeeYear?.year ? `${this.committeeYear?.year} Committee` : "";
    this.filesForYear = this.committeeQueryService.committeeFilesForYear(this.committeeYear?.year);
    const pageContent: PageContent = await this.pageContentService.findByPath(committeeYearsPath);
    this.imageSource = this.imageSourceForRelativePath(pageContent);
  }

  private imageSourceForRelativePath(pageContent: PageContent) {
    const pageContentRow: PageContentRow = pageContent.rows.find(row => this.actions.isActionButtons(row));
    const relativeUrl = this.committeeYear?.latestYear ? `${this.urlService.relativeUrl()}/year/${this.committeeQueryService?.latestYear()}` : this.urlService.relativeUrl();
    this.logger.debug("pageContentRow:", pageContentRow, "relativeUrl:", relativeUrl, "committeeYear:", this.committeeYear);
    const pageContentColumn: PageContentColumn = pageContentRow?.columns.find(column => relativeUrl.endsWith(column.href));
    return this.urlService.imageSource(pageContentColumn?.imageSource);
  }

  selectCommitteeFile(committeeFile: CommitteeFile) {
    if (this.display.confirm.noneOutstanding()) {
      this.committeeFile = committeeFile;
    }
  }

  isActive(committeeFile: CommitteeFile): boolean {
    return committeeFile === this.committeeFile;
  }

  addCommitteeFile() {
    this.display.confirm.as(ConfirmType.CREATE_NEW);
    this.committeeFile = this.display.defaultCommitteeFile();
    this.logger.debug("addCommitteeFile:", this.committeeFile, "of", this.committeeQueryService.committeeFiles.length, "files");
    this.editCommitteeFile(this.committeeFile);
  }

  editCommitteeFile(committeeFile: CommitteeFile) {
    this.modalService.show(CommitteeEditFileModalComponent, this.display.createModalOptions({confirm: this.display.confirm, committeeFile}));
  }

  sendNotification(committeeFile: CommitteeFile) {
    this.urlService.navigateTo("committee", "send-notification", committeeFile.id);
  }

  notLast(committeeFile): boolean {
    return last(this.filesForYear) !== committeeFile;
  }

  deleteCommitteeFile() {
    this.display.confirm.as(ConfirmType.DELETE);
  }
}
