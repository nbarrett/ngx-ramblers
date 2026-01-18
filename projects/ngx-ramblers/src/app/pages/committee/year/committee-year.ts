import { ChangeDetectionStrategy, Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { last } from "es-toolkit/compat";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { CommitteeFile, CommitteeYear } from "../../../models/committee.model";
import { PageContent, PageContentColumn, PageContentPath, PageContentRow } from "../../../models/content-text.model";
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
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FALLBACK_MEDIA } from "../../../models/walk.model";

@Component({
    selector: "app-committee-year",
    templateUrl: "./committee-year.html",
    styleUrls: ["./committee-year.sass"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [MarkdownEditorComponent]
})
export class CommitteeYearComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeYearComponent", NgxLoggerLevel.ERROR);
  memberLoginService = inject(MemberLoginService);
  private apiResponseProcessor = inject(ApiResponseProcessor);
  display = inject(CommitteeDisplayService);
  private authService = inject(AuthService);
  private modalService = inject(BsModalService);
  pageContentService = inject(PageContentService);
  actions = inject(PageContentActionsService);
  committeeQueryService = inject(CommitteeQueryService);
  private committeeFileService = inject(CommitteeFileService);
  urlService = inject(UrlService);
  public committeeYear: CommitteeYear;
  private subscriptions: Subscription[] = [];
  public committeeFile: CommitteeFile;
  public committeeYearTitle = "";
  public imageSource: string;


  @Input()
  public notify: AlertInstance;
  public filesForYear: CommitteeFile[];

  @Input("committeeYear") set acceptChangesFrom(committeeYear: CommitteeYear) {
    this.logger.info("committeeYear:input", committeeYear);
    this.committeeYear = committeeYear;
    this.setupDataForYear();
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
    const pageContent: PageContent = await this.pageContentService.findByPath(PageContentPath.COMMITTEE_ACTION_BUTTONS_YEARS);
    this.imageSource = this.imageSourceForRelativePath(pageContent);
    this.logger.info("pageContent:", pageContent, "imageSource:", this.imageSource);
  }

  private imageSourceForRelativePath(pageContent: PageContent) {
    const relativeUrl = this.committeeYear?.latestYear && !this.urlService.lastPathSegmentNumeric() ? `${this.urlService.relativeUrl()}/${this.committeeQueryService?.latestYear()}` : this.urlService.relativeUrl();
    const pageContentRow: PageContentRow = pageContent.rows.find(row => this.actions.isActionButtons(row) && this.columnHasRelativePathMatch(row, relativeUrl));
    const pageContentColumn = this.columnHasRelativePathMatch(pageContentRow, relativeUrl);
    this.logger.off("pageContentRow:", pageContentRow, "relativeUrl:", relativeUrl, "committeeYear:", this.committeeYear, "pageContentColumn:", pageContentColumn);
    return pageContentColumn?.imageSource;
  }

  private columnHasRelativePathMatch(pageContentRow: PageContentRow, relativeUrl: string) {
    const pageContentColumn: PageContentColumn = pageContentRow?.columns.find(column => {
      const relativePathMatch = relativeUrl.endsWith(column.href);
      this.logger.off("column:", column, "relativePathMatch:", relativePathMatch, "column.imageSource:", column.imageSource);
      return relativePathMatch;
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

  imageSourceWithFallback(): string {
    if (this.imageSource) {
      return this.urlService.imageSource(this.imageSource);
    } else {
      return this.urlService.imageSource(FALLBACK_MEDIA.url);
    }
  }
}
