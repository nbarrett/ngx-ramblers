import { Component, Input } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { RouteAudit } from "../../models/audit";
import { DisplayDateAndTimePipe } from "../../pipes/display-date-and-time.pipe";
import { DisplayDateAbbreviatedTimePipe } from "../../pipes/display-date-abbreviated-time.pipe";

@Component({
  selector: "app-route-audit",
  imports: [DisplayDateAndTimePipe, DisplayDateAbbreviatedTimePipe],
  template: `
    <small class="d-block text-muted text-break">{{ createdLabel }} by {{ audit?.createdByName || "Unknown user" }}
      @if (audit?.createdDate) {
        on {{ compact ? (audit.createdDate | displayDateAbbreviatedTime) : (audit.createdDate | displayDateAndTime) }}
      } @else {
        · Time not recorded
      }
    </small>
    @if (showUpdated()) {
      <small class="d-block text-muted text-break">Updated by {{ audit?.updatedByName || "Unknown user" }}
        @if (audit?.updatedDate) {
          on {{ compact ? (audit.updatedDate | displayDateAbbreviatedTime) : (audit.updatedDate | displayDateAndTime) }}
        } @else {
          · Time not recorded
        }
      </small>
    }
  `
})
export class RouteAuditComponent {
  @Input() audit: RouteAudit | null = null;
  @Input() createdLabel = "Created";
  compact = false;

  @Input("compact") set compactValue(value: boolean) {
    this.compact = coerceBooleanProperty(value);
  }

  showUpdated(): boolean {
    const samePerson = (this.audit?.updatedBy || null) === (this.audit?.createdBy || null)
      && (this.audit?.updatedByName || null) === (this.audit?.createdByName || null);
    const sameTime = (this.audit?.updatedDate || null) === (this.audit?.createdDate || null);
    return !(samePerson && sameTime);
  }
}
