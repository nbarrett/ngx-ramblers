import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCloudArrowDown, faFileCirclePlus, faPen, faPersonWalking } from "@fortawesome/free-solid-svg-icons";
import { UIDateFormat } from "../../models/date-format.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { Component, inject, Input } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { RouteAudit } from "../../models/audit";
import { DisplayDateAndTimePipe } from "../../pipes/display-date-and-time.pipe";
import { DisplayDateAbbreviatedTimePipe } from "../../pipes/display-date-abbreviated-time.pipe";

@Component({
  selector: "app-route-audit",
  imports: [FontAwesomeModule, DisplayDateAndTimePipe, DisplayDateAbbreviatedTimePipe],
  styles: [`
    :host
      display: block

    .route-audit-row
      display: flex
      align-items: flex-start
      gap: 0.5rem
      margin: 0
      font-family: inherit
      font-size: 0.875rem
      font-weight: 400
      line-height: 1.4

    .route-audit-row + .route-audit-row
      margin-top: 0.25rem

    .route-audit-row fa-icon
      flex: 0 0 1.15em
      width: 1.15em
      text-align: center
      line-height: 1.4

    .route-audit-row span
      min-width: 0
      flex: 1 1 auto
  `],
  template: `
    @if (iconsOnly) {
      @let createdDetails = createdLabel + " by " + (audit?.createdByName || "Unknown user") + (audit?.createdDate ? " on " + (audit.createdDate | displayDateAndTime) : "");
      @let updatedDetails = "Updated by " + (audit?.updatedByName || "Unknown user") + (audit?.updatedDate ? " on " + (audit.updatedDate | displayDateAndTime) : "");
      @let walkedDetails = "Walked" + (walkedByName ? " by " + walkedByName : "") + (walkedAt ? " on " + (walkedAt | displayDateAndTime) : "");
      <div class="small mt-1">{{ audit?.createdByName || "Unknown user" }}</div>
      <div class="d-flex flex-wrap align-items-center gap-2 mt-1 small">
        <span class="d-inline-flex align-items-center gap-1" [attr.aria-label]="createdDetails">
          <fa-icon [icon]="faFileCirclePlus"/>
          @if (showDates && audit?.createdDate) { <span class="text-nowrap">{{ shortDate(audit.createdDate) }}</span> }
        </span>
        @if (showUpdated()) {
          <span class="d-inline-flex align-items-center gap-1" [attr.aria-label]="updatedDetails">
            <fa-icon [icon]="faPen"/>
            @if (showDates && audit?.updatedDate) { <span class="text-nowrap">{{ shortDate(audit.updatedDate) }}</span> }
          </span>
        }
        @if (walkedAt || walkedByName) {
          <span class="d-inline-flex align-items-center gap-1" [attr.aria-label]="walkedDetails">
            <fa-icon [icon]="faPersonWalking"/>
            @if (walkedAt) { <span class="text-nowrap">{{ shortDate(walkedAt) }}</span> }
          </span>
        }
      </div>
    } @else {
    <small class="route-audit-row text-muted text-break">
      <fa-icon [icon]="faFileCirclePlus"/>
      <span>{{ createdLabel }} by {{ audit?.createdByName || "Unknown user" }}
        @if (audit?.createdDate) {
          on {{ compact ? (audit.createdDate | displayDateAbbreviatedTime) : (audit.createdDate | displayDateAndTime) }}
        } @else {
          · Time not recorded
        }
      </span>
    </small>
    @if (showUpdated()) {
      <small class="route-audit-row text-muted text-break">
        <fa-icon [icon]="faPen"/>
        <span>Updated by {{ audit?.updatedByName || "Unknown user" }}
          @if (audit?.updatedDate) {
            on {{ compact ? (audit.updatedDate | displayDateAbbreviatedTime) : (audit.updatedDate | displayDateAndTime) }}
          } @else {
            · Time not recorded
          }
        </span>
      </small>
    }
    @if (offlineAvailable) {
      <small class="route-audit-row text-muted text-break">
        <fa-icon [icon]="faCloudArrowDown"/>
        <span>Available off-line</span>
      </small>
    }
    }
  `
})
export class RouteAuditComponent {
  @Input() audit: RouteAudit | null = null;
  @Input() createdLabel = "Created";
  @Input() walkedAt: number | null = null;
  @Input() walkedByName: string | null = null;
  private dateUtils = inject(DateUtilsService);
  showDates = false;
  iconsOnly = false;
  offlineAvailable = false;
  protected readonly faFileCirclePlus = faFileCirclePlus;
  protected readonly faPen = faPen;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly faCloudArrowDown = faCloudArrowDown;
  compact = false;

  @Input("showDates") set showDatesValue(value: boolean) {
    this.showDates = coerceBooleanProperty(value);
  }

  shortDate(value: number): string {
    return this.dateUtils.asString(value, null, UIDateFormat.DAY_MONTH_ABBREVIATED_YEAR);
  }

  @Input("iconsOnly") set iconsOnlyValue(value: boolean) {
    this.iconsOnly = coerceBooleanProperty(value);
  }

  @Input("compact") set compactValue(value: boolean) {
    this.compact = coerceBooleanProperty(value);
  }

  @Input("offlineAvailable") set offlineAvailableValue(value: boolean) {
    this.offlineAvailable = coerceBooleanProperty(value);
  }

  showUpdated(): boolean {
    const samePerson = (this.audit?.updatedBy || null) === (this.audit?.createdBy || null)
      && (this.audit?.updatedByName || null) === (this.audit?.createdByName || null);
    const sameTime = (this.audit?.updatedDate || null) === (this.audit?.createdDate || null);
    return !(samePerson && sameTime);
  }
}
