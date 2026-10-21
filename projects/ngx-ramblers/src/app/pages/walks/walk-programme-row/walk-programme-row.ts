import { Component, HostBinding, inject, Input } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faEye, faLocationDot, faPenToSquare, faPersonWalking } from "@fortawesome/free-solid-svg-icons";
import { DisplayedWalk } from "../../../models/walk.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import {
  ProgrammeOverviewStatus,
  programmeStatusDescriptor,
  WalkProgrammeSummaryRow
} from "../../../models/walk-programme.model";
import { WalkLeadEditAppearance } from "../../../models/walk-edit-mode.model";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalkDisplayService } from "../walk-display.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UrlService } from "../../../services/url.service";
import { WalkLeadEditButton } from "../walk-view/walk-lead-edit-button";

@Component({
  selector: "app-walk-programme-row",
  imports: [FontAwesomeModule, WalkLeadEditButton],
  styleUrls: ["./walk-programme-row.sass"],
  template: `
    <div class="walk-row" role="button" tabindex="0" [style.--status-colour]="descriptor().colour"
         (click)="openWalk()" (keydown.enter)="openWalk()" (keydown.space)="openWalk()">
      <div class="walk-row-date">
        <span class="walk-day">{{ dayName() }}</span>
        <span class="walk-date">{{ dateShort() }}</span>
        <span class="walk-countdown">{{ countdown() }}</span>
      </div>
      @if (reserveThumbnail) {
        <div class="walk-row-thumbnail-cell">
          @if (row.thumbnailUrl) {
            <img class="walk-row-thumbnail" [src]="thumbnailSource()" [alt]="row.title || 'Walk image'"/>
          }
        </div>
      }
      <div class="walk-row-main">
        <div class="walk-row-title">
          @if (showGroup && groupLabel()) {
            <span class="group-badge">{{ groupLabel() }}</span>
          }
          {{ row.title || "Untitled walk slot" }}
        </div>
        <div class="walk-row-meta">
          @if (row.leaderName) {
            <span><fa-icon [icon]="faPersonWalking"/> {{ row.leaderName }}</span>
          } @else if (!display.walkPopulationWalksManager()) {
            <span><fa-icon [icon]="faPersonWalking"/> No leader</span>
          }
          @if (row.distanceMiles) {
            <span>{{ row.distanceMiles }} miles</span>
          }
          @if (row.gradeDescription) {
            <span>{{ row.gradeDescription }}</span>
          }
          @if (!row.hasLocation) {
            <span class="muted"><fa-icon [icon]="faLocationDot"/> No location</span>
          }
        </div>
        @if (whatsMissing().length > 0) {
          <div class="walk-row-missing">
            <fa-icon [icon]="faCircleExclamation"/>
            <span>Needs: {{ whatsMissing().join(", ") }}</span>
          </div>
        }
      </div>
      <div class="walk-row-status">
        <span class="status-badge" [style.background-color]="descriptor().colour"
              [style.color]="descriptor().textColour">{{ descriptor().title }}</span>
      </div>
      <div class="walk-row-view" (click)="$event.stopPropagation()">
        <button type="button" class="btn pager-btn d-flex align-items-center justify-content-center gap-1 text-nowrap"
                (click)="openWalk(); $event.stopPropagation()"
                [title]="'View ' + (row.title || 'this walk') + ' as it appears on the website'">
          <fa-icon [icon]="faEye"/>
          <span>View</span>
        </button>
      </div>
      <div class="walk-row-edit" (click)="$event.stopPropagation()">
        @if (allowEdit && row.status === ProgrammeOverviewStatus.AWAITING_LEADER) {
          <app-walk-lead-edit-button [displayedWalk]="leadEditDisplayedWalk()"
                                     [appearance]="WalkLeadEditAppearance.INLINE"/>
        } @else if (allowEdit) {
          <button type="button" class="btn pager-btn-primary d-flex align-items-center justify-content-center gap-1 text-nowrap"
                  [title]="actionTooltip()"
                  (click)="editWalk(); $event.stopPropagation()">
            <fa-icon [icon]="faPenToSquare"/>
            <span>{{ actionLabel() }}</span>
          </button>
        }
      </div>
    </div>
  `
})
export class WalkProgrammeRowComponent {
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  private urlService = inject(UrlService);

  protected readonly faEye = faEye;
  protected readonly faPenToSquare = faPenToSquare;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly faLocationDot = faLocationDot;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly ProgrammeOverviewStatus = ProgrammeOverviewStatus;
  protected readonly WalkLeadEditAppearance = WalkLeadEditAppearance;

  @Input({required: true}) row: WalkProgrammeSummaryRow;
  allowEdit = false;
  showGroup = false;
  reserveThumbnail = false;

  @Input("allowEdit") set allowEditValue(value: boolean) {
    this.allowEdit = coerceBooleanProperty(value);
  }

  @Input("showGroup") set showGroupValue(value: boolean) {
    this.showGroup = coerceBooleanProperty(value);
  }

  @Input("reserveThumbnail") set reserveThumbnailValue(value: boolean) {
    this.reserveThumbnail = coerceBooleanProperty(value);
  }

  @HostBinding("class.with-thumbnail")
  get thumbnailHost(): boolean {
    return this.reserveThumbnail;
  }

  descriptor() {
    return programmeStatusDescriptor(this.row.status);
  }

  groupLabel(): string {
    return this.row.groupName || this.row.groupCode || "";
  }

  thumbnailSource(): string {
    return this.urlService.imageSource(this.row.thumbnailUrl, false, true);
  }

  dayName(): string {
    return this.dateUtils.asString(this.row.startDateTime, null, "ccc");
  }

  dateShort(): string {
    return this.dateUtils.asString(this.row.startDateTime, null, "d MMM yyyy");
  }

  countdown(): string {
    return this.dateUtils.relativeDay(this.row.startDateTime);
  }

  whatsMissing(): string[] {
    return [
      this.row.leaderName || this.display.walkPopulationWalksManager() ? null : "leader",
      this.row.title ? null : "walk details",
      this.row.distanceMiles ? null : "distance",
      this.row.gradeDescription ? null : "grade",
      this.row.hasLocation ? null : "start location"
    ].filter(item => item);
  }

  actionLabel(): string {
    return this.awaitingApproval() ? "Review & approve" : "Edit";
  }

  actionTooltip(): string {
    const walkName = this.row.title || "this walk";
    return this.awaitingApproval()
      ? `Open ${walkName} to check its details and approve it`
      : this.inPast()
        ? `Open ${walkName} for editing. This walk has already taken place, so nothing normally needs doing to it.`
        : `Open ${walkName} for editing`;
  }

  openWalk() {
    this.display.openWalkViewFor(this.navIdentifier());
  }

  editWalk() {
    this.display.openWalkEditFor(this.navIdentifier(), {
      bypassLeaderInit: this.row.status === ProgrammeOverviewStatus.AWAITING_LEADER
    });
  }

  leadEditDisplayedWalk(): DisplayedWalk {
    return {
      walk: {
        id: this.row.id,
        groupEvent: {
          item_type: this.row.itemType,
          url: this.row.url,
          title: this.row.title
        }
      } as ExtendedGroupEvent,
      walkAccessMode: WalksReferenceService.walkAccessModes.lead
    } as DisplayedWalk;
  }

  private awaitingApproval(): boolean {
    return this.row.status === ProgrammeOverviewStatus.AWAITING_APPROVAL;
  }

  private inPast(): boolean {
    return Math.round(this.dateUtils.asDateTime(this.row.startDateTime).startOf("day").diff(this.dateUtils.dateTimeNowNoTime(), "days").days) < 0;
  }

  private navIdentifier(): string {
    const slug = (this.row.url || "").split("/").filter(segment => segment).pop();
    return slug || this.row.id;
  }
}
