import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationEnd, ParamMap, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { CommitteeFile, CommitteeYear, committeeYearsPath } from "../../../models/committee.model";
import { PageContent, PageContentColumn, PageContentType } from "../../../models/content-text.model";
import { AccessLevel } from "../../../models/member-resource.model";
import { LoginResponse, Member } from "../../../models/member.model";
import { Confirm } from "../../../models/ui-actions";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { ContentTextService } from "../../../services/content-text.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { UrlService } from "../../../services/url.service";
import { filter } from "rxjs/operators";

@Component({
  selector: "app-committee-home",
  templateUrl: "./committee-home.component.html",
  changeDetection: ChangeDetectionStrategy.Default
})
export class CommitteeHomeComponent implements OnInit, OnDestroy {
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public allowAdminEdits: boolean;
  private destinationType: string;
  public members: Member[];
  private selected: { committeeFile?: CommitteeFile, committeeFiles: CommitteeFile[] };
  public confirm = new Confirm();
  public committeeYear: CommitteeYear;
  private committeeFileId: string;
  public pageTitle: string;

  constructor(private pageService: PageService,
              private memberLoginService: MemberLoginService,
              private memberService: MemberService,
              private notifierService: NotifierService,
              private router: Router,
              private route: ActivatedRoute,
              private authService: AuthService,
              private urlService: UrlService,
              private dateUtils: DateUtilsService,
              public pageContentService: PageContentService,
              public contentTextService: ContentTextService,
              private committeeFileService: CommitteeFileService,
              private committeeQueryService: CommitteeQueryService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeHomeComponent, NgxLoggerLevel.OFF);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.committeeYearChange("ngOnInit");
    this.pageService.setTitle();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
    this.destinationType = "";
    this.selected = {
      committeeFiles: []
    };
    this.refreshAll();
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.committeeYearChange("route change");
      this.committeeFileId = paramMap.get("relativePath");
      this.logger.info("committeeFileId from route params:", paramMap, this.committeeFileId);
      this.notify.setReady();
      this.refreshCommitteeFiles();
    }));
    this.subscriptions.push(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((val) => {
      this.logger.info("router event:", val);
      this.committeeYearChange("route event");
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private committeeYearChange(reason: string) {
    const year = this.urlService.lastPathSegmentNumeric() ? +this.urlService.lastPathSegment() : this.committeeQueryService.latestYear();
    const committeeYear = {year, latestYear: this.committeeQueryService.latestYear() === year};
    this.logger.info("overridden committeeYear:", committeeYear);
    this.committeeYear = committeeYear;
    this.pageTitle = committeeYear.latestYear ? this.pageTitle = "Committee" : "Committee Year " + committeeYear.year;
    this.logger.info("reason:", reason, "lastPathSegment:", this.urlService.lastPathSegment(), year, "pageTitle:", this.pageTitle);
  }

  private refreshCommitteeFiles() {
    this.committeeQueryService.queryFiles(this.committeeFileId)
        .then(() => {
          this.committeeYear = this.committeeQueryService.thisCommitteeYear();
          this.logger.info("refreshCommitteeFiles:committeeYear:", this.committeeYear);
          this.generateActionButtons();
          this.confirm.clear();
        });
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.allowAdminEdits = this.memberLoginService.allowMemberAdminEdits();
    this.refreshAll();
  }

  showCommitteeFileDeleted() {
    return this.notify.success("File was deleted successfully");
  }

  refreshMembers() {
    this.logger.info("refreshMembers:allowFileAdmin:", this.memberLoginService.allowFileAdmin());
    if (this.memberLoginService.allowFileAdmin()) {
      return this.memberService.all()
        .then(members => this.members = members);

    }
  }

  refreshAll() {
    this.refreshCommitteeFiles();
    this.refreshMembers();
  }

  showAlertMessage(): boolean {
    return this.notifyTarget.busy || this.notifyTarget.showAlert;
  }

  private generateActionButtons() {
    this.pageContentService.findByPath(committeeYearsPath)
      .then(async response => {
        this.logger.debug("response:", response);
        if (!response) {
          const unresolvedColumns: Promise<PageContentColumn>[] = this.committeeQueryService.committeeFileYears()
            .map(async (year: CommitteeYear) => {
              const contentTextId: string = (await this.contentTextService.create({
                name: `committee-year-${year.year}`,
                category: "committee-years",
                text: `View committee files for ${year.year}`
              })).id;
              const column: PageContentColumn = {
                accessLevel: AccessLevel.public,
                title: year.year.toString(),
                icon: "faCalendarAlt",
                href: `committee/${year.year}`,
                contentTextId
              };
              return column;
            });
          Promise.all(unresolvedColumns).then((columns: PageContentColumn[]) => {
            const data: PageContent = {
              path: committeeYearsPath,
              rows: [
                {
                  maxColumns: 4,
                  showSwiper: true,
                  type: PageContentType.ACTION_BUTTONS,
                  columns
                }]
            };
            this.logger.debug("generated data:", data);
            this.pageContentService.createOrUpdate(data);
          });
        } else {
          this.logger.debug("found existing page content", response);
        }
      })
      .catch(async error => {
        this.logger.debug("error:", error);
      });
  }

}
