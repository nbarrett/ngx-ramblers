import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faCircleExclamation, faHandshake, faPenToSquare, faPersonHiking, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { PageComponent } from "../../../page/page.component";
import { WalkProgrammeViewSelector } from "../walk-programme-view-selector/walk-programme-view-selector";
import { Member } from "../../../models/member.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { DisplayedWalk, EventType } from "../../../models/walk.model";
import { displayedWalkProgrammeStatus, programmeStatusDescriptor, ProgrammeOverviewStatus } from "../../../models/walk-programme.model";
import { WalkProgrammeService } from "../../../services/walks-and-events/walk-programme.service";
import { WalkDisplayService } from "../walk-display.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UrlService } from "../../../services/url.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-walk-leader-dashboard",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, NgTemplateOutlet, FontAwesomeModule, WalkProgrammeViewSelector],
  styleUrls: ["./walk-leader-dashboard.sass"],
  styles: [`
    .my-walks-back
      position: absolute
      top: 0
      right: 0
      z-index: 6
  `],
  template: `
    <app-page autoTitle>
      <button type="button" class="btn pager-btn rounded my-walks-back" (click)="goBack()">
        <fa-icon [icon]="faArrowLeft" class="me-2"/>{{ display.returnToPreviousViewLabel() }}
      </button>
      <app-walk-programme-view-selector/>
      <div class="leader">
        <div class="leader-intro">
          <p>Your walks in one place: what you are leading, anything still needing detail or approval, and slots you can
            put your name to.</p>
        </div>

        <section class="leader-section">
          <h3><fa-icon [icon]="faCircleExclamation" class="ramblers"/> Needs your attention</h3>
          @if (outstanding.length === 0) {
            <p class="empty">Nothing outstanding. Every walk you lead has its details in.</p>
          } @else {
            <div class="walk-rows">
              @for (displayedWalk of outstanding; track displayedWalk.walk.id) {
                <ng-container [ngTemplateOutlet]="walkRow" [ngTemplateOutletContext]="{$implicit: displayedWalk, showEdit: true}"/>
              }
            </div>
          }
        </section>

        <section class="leader-section">
          <h3><fa-icon [icon]="faPersonHiking" class="ramblers"/> Walks you are leading</h3>
          @if (upcoming.length === 0) {
            <p class="empty">You have no upcoming walks in the current period.</p>
          } @else {
            <div class="walk-rows">
              @for (displayedWalk of upcoming; track displayedWalk.walk.id) {
                <ng-container [ngTemplateOutlet]="walkRow" [ngTemplateOutletContext]="{$implicit: displayedWalk, showEdit: allowEdit()}"/>
              }
            </div>
          }
        </section>

        @if (display.walkPopulationLocal()) {
          <section class="leader-section">
            <h3><fa-icon [icon]="faHandshake" class="ramblers"/> Slots looking for a leader</h3>
            @if (availableSlots.length === 0) {
              <p class="empty">No unallocated slots in the current period.</p>
            } @else {
              <div class="walk-rows">
                @for (displayedWalk of availableSlots; track displayedWalk.walk.id) {
                  <ng-container [ngTemplateOutlet]="walkRow" [ngTemplateOutletContext]="{$implicit: displayedWalk, slot: true}"/>
                }
              </div>
            }
          </section>
        }

      </div>
    </app-page>

    <ng-template #walkRow let-displayedWalk let-showEdit="showEdit" let-slot="slot">
      <div class="walk-row" role="button" tabindex="0" [style.--status-colour]="descriptorFor(displayedWalk).colour"
           (click)="openWalk(displayedWalk, false)"
           (keydown.enter)="openWalk(displayedWalk, false)"
           (keydown.space)="openWalk(displayedWalk, false)">
        <div class="walk-row-date">
          <span class="walk-day">{{ dayName(displayedWalk) }}</span>
          <span class="walk-date">{{ dateShort(displayedWalk) }}</span>
        </div>
        <div class="walk-row-main">
          <div class="walk-row-title">{{ displayedWalk.walk.groupEvent.title || (slot ? "Available walk slot" : "Walk slot") }}</div>
          <div class="walk-row-meta">
            @if (slot) {
              <span>This slot has no leader yet.</span>
            } @else {
              <span class="status-badge" [style.background-color]="descriptorFor(displayedWalk).colour"
                    [style.color]="descriptorFor(displayedWalk).textColour">{{ descriptorFor(displayedWalk).title }}</span>
              @if (displayedWalk.walk.groupEvent.distance_miles) {
                <span>{{ displayedWalk.walk.groupEvent.distance_miles }} miles</span>
              }
            }
          </div>
        </div>
        <div class="walk-row-actions">
          @if (slot) {
            <button type="button" class="btn btn-sm btn-primary" (click)="volunteer(displayedWalk); $event.stopPropagation()">
              <fa-icon [icon]="faHandshake"/>
              <span class="ms-1">Volunteer to lead</span>
            </button>
          } @else {
            <button type="button" class="btn btn-sm btn-quiet" (click)="openWalk(displayedWalk, false); $event.stopPropagation()">Open</button>
            @if (showEdit) {
              <button type="button" class="btn btn-sm btn-primary" (click)="openWalk(displayedWalk, true); $event.stopPropagation()">
                <fa-icon [icon]="faPenToSquare"/>
                <span class="ms-1">Edit</span>
              </button>
            }
          }
        </div>
      </div>
    </ng-template>
  `
})
export class WalkLeaderDashboardComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkLeaderDashboardComponent", NgxLoggerLevel.ERROR);
  private walkProgrammeService = inject(WalkProgrammeService);
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  private urlService = inject(UrlService);
  private memberLoginService = inject(MemberLoginService);
  private memberService = inject(MemberService);
  private systemConfigService = inject(SystemConfigService);
  private walksConfigService = inject(WalksConfigService);
  private subscriptions: Subscription[] = [];

  protected upcoming: DisplayedWalk[] = [];
  protected outstanding: DisplayedWalk[] = [];
  protected availableSlots: DisplayedWalk[] = [];
  protected member: Member;

  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faPersonHiking = faPersonHiking;
  protected readonly faHandshake = faHandshake;
  protected readonly faPenToSquare = faPenToSquare;
  protected readonly faTriangleExclamation = faTriangleExclamation;

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
    const end = start.plus({weeks: this.defaultWeeks()});
    try {
      const myEvents = await this.walkProgrammeService.walksLedBy([memberId, this.member?.contactId], start.valueOf(), end.endOf("day").valueOf());
      const myWalks = myEvents
        .map(event => this.display.toDisplayedWalk(event))
        .filter(displayedWalk => this.display.statusFor(displayedWalk.walk) !== EventType.DELETED);
      this.upcoming = myWalks;
      this.outstanding = myWalks.filter(displayedWalk => this.outstandingStatuses.includes(this.statusOf(displayedWalk)));
      await this.loadAvailableSlots(start.valueOf(), end.endOf("day").valueOf());
    } catch (error) {
      this.logger.error("reload:error", error);
    }
  }

  private async loadAvailableSlots(dateFrom: number, dateTo: number) {
    if (this.display.walkPopulationLocal()) {
      const events: ExtendedGroupEvent[] = await this.walkProgrammeService.eventsInRange({dateFrom, dateTo, walksOnly: true});
      this.availableSlots = events
        .map(event => this.display.toDisplayedWalk(event))
        .filter(displayedWalk => this.display.statusFor(displayedWalk.walk) === EventType.AWAITING_LEADER);
    } else {
      this.availableSlots = [];
    }
  }

  private statusOf(displayedWalk: DisplayedWalk): ProgrammeOverviewStatus {
    return displayedWalkProgrammeStatus(displayedWalk.walk, displayedWalk.status);
  }

  descriptorFor(displayedWalk: DisplayedWalk) {
    return programmeStatusDescriptor(this.statusOf(displayedWalk));
  }

  allowEdit(): boolean {
    return this.display.walkPopulationLocal();
  }

  dayName(displayedWalk: DisplayedWalk): string {
    return this.dateUtils.asString(displayedWalk.walk.groupEvent.start_date_time, null, "ccc");
  }

  dateShort(displayedWalk: DisplayedWalk): string {
    return this.dateUtils.asString(displayedWalk.walk.groupEvent.start_date_time, null, "d MMM yyyy");
  }

  openWalk(displayedWalk: DisplayedWalk, edit: boolean): Promise<boolean> {
    return edit ? this.display.openWalkEdit(displayedWalk.walk) : this.display.openWalkView(displayedWalk.walk);
  }

  volunteer(displayedWalk: DisplayedWalk): Promise<boolean> {
    return this.openWalk(displayedWalk, true);
  }
}
