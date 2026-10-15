import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faCalendarPlus, faCircleExclamation, faHandshake, faPersonHiking } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { WalkProgrammePageComponent } from "../walk-programme-view-selector/walk-programme-page";
import { CalendarSubscribeComponent } from "../../../modules/common/related-links/calendar-subscribe";
import { Member } from "../../../models/member.model";
import {
  ProgrammeOverviewStatus,
  ProgrammeSortDirection,
  WalkProgrammeSummaryRow
} from "../../../models/walk-programme.model";
import { WalkProgrammeService } from "../../../services/walks-and-events/walk-programme.service";
import { WalkDisplayService } from "../walk-display.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkProgrammeRowComponent } from "../walk-programme-row/walk-programme-row";

@Component({
  selector: "app-walk-leader-dashboard",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CalendarSubscribeComponent, WalkProgrammePageComponent, FontAwesomeModule, WalkProgrammeRowComponent],
  styleUrls: ["./walk-leader-dashboard.sass"],
  template: `
    <app-walk-programme-page>
      <button programmeChrome type="button" class="btn pager-btn rounded my-walks-back" (click)="goBack()">
        <fa-icon [icon]="faArrowLeft" class="me-2"/>{{ display.returnToPreviousViewLabel() }}
      </button>
      <div class="leader">
        <div class="leader-intro">
          <p>Your walks in one place: what you are leading, anything still needing detail or approval, and slots you can
            put your name to.</p>
        </div>

        <section class="leader-section">
          <h3><fa-icon [icon]="faCalendarPlus" class="ramblers"/> Keep up with walks and events</h3>
          <div class="walk-row calendar-subscription-row">
            <app-calendar-subscribe class="d-block" [memberId]="member?.id"/>
          </div>
        </section>

        <section class="leader-section">
          <h3><fa-icon [icon]="faCircleExclamation" class="ramblers"/> Needs your attention</h3>
          @if (outstandingRows.length === 0) {
            <p class="empty">Nothing outstanding. Every walk you lead has its details in.</p>
          } @else {
            <div class="walk-rows">
              @for (row of outstandingRows; track row.id) {
                <app-walk-programme-row [row]="row" [allowEdit]="true" [reserveThumbnail]="anyThumbnails()"/>
              }
            </div>
          }
        </section>

        <section class="leader-section">
          <h3><fa-icon [icon]="faPersonHiking" class="ramblers"/> Walks you are leading</h3>
          @if (upcomingRows.length === 0) {
            <p class="empty">You have no upcoming walks in the current period.</p>
          } @else {
            <div class="walk-rows">
              @for (row of upcomingRows; track row.id) {
                <app-walk-programme-row [row]="row" [allowEdit]="allowEdit()" [reserveThumbnail]="anyThumbnails()"/>
              }
            </div>
          }
        </section>

        @if (display.walkPopulationLocal()) {
          <section class="leader-section">
            <h3><fa-icon [icon]="faHandshake" class="ramblers"/> Slots looking for a leader</h3>
            @if (availableSlotRows.length === 0) {
              <p class="empty">No unallocated slots in the current period.</p>
            } @else {
              <div class="walk-rows">
                @for (row of availableSlotRows; track row.id) {
                  <app-walk-programme-row [row]="row" [allowEdit]="true" [reserveThumbnail]="anyThumbnails()"/>
                }
              </div>
            }
          </section>
        }

      </div>
    </app-walk-programme-page>
  `
})
export class WalkLeaderDashboardComponent implements OnInit, OnDestroy {

  protected readonly faCalendarPlus = faCalendarPlus;

  private logger: Logger = inject(LoggerFactory).createLogger("WalkLeaderDashboardComponent", NgxLoggerLevel.ERROR);
  private walkProgrammeService = inject(WalkProgrammeService);
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  private memberLoginService = inject(MemberLoginService);
  private memberService = inject(MemberService);
  private systemConfigService = inject(SystemConfigService);
  private walksConfigService = inject(WalksConfigService);
  private subscriptions: Subscription[] = [];

  protected upcomingRows: WalkProgrammeSummaryRow[] = [];
  protected outstandingRows: WalkProgrammeSummaryRow[] = [];
  protected availableSlotRows: WalkProgrammeSummaryRow[] = [];
  protected member: Member;

  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faPersonHiking = faPersonHiking;
  protected readonly faHandshake = faHandshake;

  private readonly outstandingStatuses: ProgrammeOverviewStatus[] = [
    ProgrammeOverviewStatus.AWAITING_WALK_DETAILS,
    ProgrammeOverviewStatus.AWAITING_APPROVAL,
    ProgrammeOverviewStatus.DRAFT
  ];

  ngOnInit() {
    this.subscriptions.push(this.systemConfigService.events().subscribe(() => this.reload()));
    this.subscriptions.push(this.walksConfigService.events().subscribe(() => this.reload()));
    this.loadMember();
  }

  goBack() {
    this.display.returnToPreviousView();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private defaultWeeks(): number {
    const configured = this.walksConfigService.walksConfig()?.programmeOverviewDefaultWeeks;
    return configured && configured > 0 ? configured : 12;
  }

  private async loadMember() {
    try {
      this.member = await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    } catch (error) {
      this.logger.error("loadMember:error", error);
    }
    this.reload();
  }

  private async reload() {
    const memberId = this.memberLoginService.loggedInMember().memberId;
    const start = this.dateUtils.dateTimeNowNoTime();
    const dateFrom = start.valueOf();
    const dateTo = start.plus({weeks: this.defaultWeeks()}).endOf("day").valueOf();
    try {
      const [led, summary] = await Promise.all([
        this.walkProgrammeService.walksLedBy([memberId, this.member?.contactId], dateFrom, dateTo),
        this.walkProgrammeService.programmeSummary({
          dateFrom,
          dateTo,
          page: 1,
          limit: 500,
          sortDirection: ProgrammeSortDirection.ASC
        })
      ]);
      const ledIds = new Set(led.map(event => event.id));
      const mine = summary.response.filter(row => ledIds.has(row.id));
      this.upcomingRows = mine;
      this.outstandingRows = mine.filter(row => this.outstandingStatuses.includes(row.status));
      this.availableSlotRows = this.display.walkPopulationLocal()
        ? summary.response.filter(row => row.status === ProgrammeOverviewStatus.AWAITING_LEADER)
        : [];
    } catch (error) {
      this.logger.error("reload:error", error);
    }
  }

  allowEdit(): boolean {
    return this.display.walkPopulationLocal();
  }

  anyThumbnails(): boolean {
    return [...this.upcomingRows, ...this.outstandingRows, ...this.availableSlotRows].some(row => !!row.thumbnailUrl);
  }
}
