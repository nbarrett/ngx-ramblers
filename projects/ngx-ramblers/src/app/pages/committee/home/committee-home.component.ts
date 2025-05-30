import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationEnd, ParamMap, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { CommitteeYear } from "../../../models/committee.model";
import {
  BuiltInAnchor,
  PageContent,
  PageContentColumn,
  PageContentPath,
  PageContentType
} from "../../../models/content-text.model";
import { AccessLevel } from "../../../models/member-resource.model";
import { LoginResponse, Member } from "../../../models/member.model";
import { Confirm } from "../../../models/ui-actions";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { ContentTextService } from "../../../services/content-text.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { UrlService } from "../../../services/url.service";
import { filter } from "rxjs/operators";
import { PageComponent } from "../../../page/page.component";
import { CommitteeYearComponent } from "../year/committee-year";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-committee-home",
    templateUrl: "./committee-home.component.html",
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [PageComponent, CommitteeYearComponent, DynamicContentComponent, FontAwesomeModule]
})
export class CommitteeHomeComponent implements OnInit, OnDestroy {

  constructor() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
  }
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeHomeComponent", NgxLoggerLevel.ERROR);
  private pageService = inject(PageService);
  private memberLoginService = inject(MemberLoginService);
  private memberService = inject(MemberService);
  private notifierService = inject(NotifierService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private urlService = inject(UrlService);
  pageContentService = inject(PageContentService);
  contentTextService = inject(ContentTextService);
  private committeeQueryService = inject(CommitteeQueryService);
  private subscriptions: Subscription[] = [];
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public allowAdminEdits: boolean;
  public members: Member[];
  public confirm: Confirm = new Confirm();
  public committeeYear: CommitteeYear;
  private committeeFileId: string;
  public pageTitle: string;
  protected readonly BuiltInAnchor = BuiltInAnchor;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.committeeYearChange("ngOnInit");
    this.pageService.setTitle();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
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
          this.logger.info("refreshCommitteeFiles:committeeYear:", this.committeeYear);
          this.generateActionButtons();
          this.confirm.clear();
        });
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.allowAdminEdits = this.memberLoginService.allowMemberAdminEdits();
    this.refreshAll();
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
    this.pageContentService.findByPath(PageContentPath.COMMITTEE_ACTION_BUTTONS_YEARS)
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
              path: PageContentPath.COMMITTEE_ACTION_BUTTONS_YEARS,
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
