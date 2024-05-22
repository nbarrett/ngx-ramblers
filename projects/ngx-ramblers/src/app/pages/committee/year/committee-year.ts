import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from "@angular/core";
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
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance } from "../../../services/notifier.service";
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
    private apiResponseProcessor: ApiResponseProcessor,
    public display: CommitteeDisplayService,
    private authService: AuthService,
    private modalService: BsModalService,
    public pageContentService: PageContentService,
    public actions: PageContentActionsService,
    public committeeQueryService: CommitteeQueryService,
    private committeeFileService: CommitteeFileService,
    public urlService: UrlService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeYearComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:committeeYear", this.committeeYear);
    this.committeeQueryService.queryAllFiles().then(() => this.setupDataForYear());
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.committeeQueryService.queryAllFiles();
    }));
    this.subscriptions.push(this.committeeFileService.notifications().subscribe(apiResponse => {
      this.logger.info("received apiResponse:", apiResponse);
      if (apiResponse.error) {
        this.logger.warn("received error:", apiResponse.error);
      } else {
        this.filesForYear = this.apiResponseProcessor.processResponse(this.logger, this.filesForYear, apiResponse);
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private async setupDataForYear(): Promise<void> {
    this.logger.info("committeeYear:", this.committeeYear, "committeeYearTitle:", this.committeeYearTitle);
    this.committeeYearTitle = this.committeeYear?.year ? `${this.committeeYear?.year} Committee` : "";
    this.filesForYear = this.committeeQueryService.committeeFilesForYear(this.committeeYear?.year);
    this.logger.info("committeeYear:", this.committeeYear, "filesForYear:", this.filesForYear);
    const pageContent: PageContent = await this.pageContentService.findByPath(committeeYearsPath);
    this.imageSource = this.imageSourceForRelativePath(pageContent);
    this.logger.info("pageContent:", pageContent, "imageSource:", this.imageSource);
  }

  private imageSourceForRelativePath(pageContent: PageContent) {
    const relativeUrl = this.committeeYear?.latestYear && !this.urlService.lastPathSegmentNumeric() ? `${this.urlService.relativeUrl()}/${this.committeeQueryService?.latestYear()}` : this.urlService.relativeUrl();
    const pageContentRow: PageContentRow = pageContent.rows.find(row => this.actions.isActionButtons(row) && this.columnHasRelativePathMatch(row, relativeUrl));
    const pageContentColumn = this.columnHasRelativePathMatch(pageContentRow, relativeUrl);
    this.logger.info("pageContentRow:", pageContentRow, "relativeUrl:", relativeUrl, "committeeYear:", this.committeeYear, "pageContentColumn:", pageContentColumn);
    return this.urlService.imageSource(pageContentColumn?.imageSource);
  }

  private columnHasRelativePathMatch(pageContentRow: PageContentRow, relativeUrl: string) {
    const pageContentColumn: PageContentColumn = pageContentRow?.columns.find(column => {
      const relativePathMatch = relativeUrl.endsWith(column.href);
      this.logger.info("column:", column, "relativePathMatch:", relativePathMatch, "column?.imageSource:", column?.imageSource);
      return relativePathMatch && column?.imageSource;
    });
    return pageContentColumn;
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
    this.logger.info("addCommitteeFile:", this.committeeFile, "of", this.committeeQueryService.committeeFiles.length, "files");
    this.editCommitteeFile(this.committeeFile);
  }

  editCommitteeFile(committeeFile: CommitteeFile) {
    this.modalService.show(CommitteeEditFileModalComponent, this.display.createModalOptions({confirm: this.display.confirm, committeeFile}));
  }

  sendNotification(committeeFile: CommitteeFile) {
    this.urlService.navigateTo(["committee", "send-notification", committeeFile.id]);
  }

  notLast(committeeFile): boolean {
    return last(this.filesForYear) !== committeeFile;
  }

  deleteCommitteeFile() {
    this.display.confirm.as(ConfirmType.DELETE);
  }
}
