import { Component, inject, Input } from "@angular/core";
import { DisplayedWalk, EventType, GroupEventField } from "../../../models/walk.model";
import { WalkDisplayService } from "../walk-display.service";
import { DisplayedEvent } from "../../../models/walk-displayed-event.model";
import { MemberIdToFullNamePipe } from "../../../pipes/member-id-to-full-name.pipe";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { EventNotePipe } from "../../../pipes/event-note.pipe";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { sortBy } from "../../../functions/arrays";
import { GroupEventService } from "../../../services/walks-and-events/group-event.service";
import { set, startCase } from "es-toolkit/compat";
import { AuditDeltaValuePipe } from "../../../pipes/audit-delta-value.pipe";
import { AUDITED_FIELDS, WalkEvent } from "../../../models/walk-event.model";
import { ChangedItemDisplay } from "../../../models/changed-item.model";
import { VisibilityToggleButton } from "../../../shared/components/visibility-toggle-button";
import { HumanisePipe } from "../../../pipes/humanise.pipe";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-walk-edit-history",
  imports: [VisibilityToggleButton, HumanisePipe, DisplayDateAndTimePipe, FontAwesomeModule, TooltipDirective],
  styles: [`
    .history-accordion
      border: 1px solid #dee2e6
      border-radius: 6px
      overflow: hidden

    .history-item
      border-bottom: 1px solid #dee2e6

    .history-item:last-child
      border-bottom: none

    .history-item:nth-child(odd)
      background-color: #ffffff

    .history-item:nth-child(even)
      background-color: #f8f9fa

    .history-item.expanded
      background-color: rgba(155, 200, 171, 0.15)
      border-left: 3px solid var(--ramblers-colour-mintcake, rgb(155, 200, 171))

    .history-header
      display: grid
      grid-template-columns: 28px 190px 130px 200px 1fr
      gap: 12px
      padding: 12px 16px
      align-items: start
      transition: background-color 0.15s ease

    .history-header.clickable
      cursor: pointer

    .history-header.clickable:hover
      background-color: #e9ecef

    .history-item.expanded .history-header.clickable:hover
      background-color: rgba(155, 200, 171, 0.25)

    .history-toggle
      display: flex
      justify-content: center
      align-items: center
      gap: 6px
      padding-top: 2px

    .history-revert
      cursor: pointer
      color: var(--ramblers-colour-mintcake, rgb(155, 200, 171))
      font-size: 1.2em
      padding: 3px
      border-radius: 4px
      transition: all 0.15s ease
      flex-shrink: 0
      margin-top: 2px

    .history-notes .history-revert
      float: right
      margin: -2px 0 4px 12px

    .history-revert:hover
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))
      background-color: rgba(155, 200, 171, 0.2)

    .history-date
      font-weight: 500
      color: #495057

    .history-member
      color: #6c757d

    .history-event-type
      color: #495057

    .history-notes
      color: #212529

    .history-item.expanded .history-notes
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis

    .history-details
      padding: 16px
      animation: slideDown 0.2s ease-out

    .history-details.with-revert
      padding-right: 0

    @keyframes slideDown
      from
        opacity: 0
        transform: translateY(-8px)
      to
        opacity: 1
        transform: translateY(0)

    .history-changes-table
      width: 100%
      border-collapse: separate
      border-spacing: 0
      background: white
      border-radius: 8px
      overflow: hidden
      border: 1px solid rgba(155, 200, 171, 0.4)
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)

    .history-changes-table th,
    .history-changes-table td
      padding: 10px 14px
      vertical-align: top
      border-bottom: 1px solid #e9ecef

    .history-changes-table th
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.3), rgba(155, 200, 171, 0.15))
      color: #495057
      font-weight: 600
      text-align: left

    .history-changes-table tbody tr:last-child td
      border-bottom: none

    .history-changes-table tbody tr:nth-child(odd)
      background-color: #ffffff

    .history-changes-table tbody tr:nth-child(even)
      background-color: #fafafa

    .history-changes-table tbody tr:hover
      background-color: rgba(155, 200, 171, 0.1)

    .history-no-changes
      color: #6c757d
      font-style: italic
      padding: 12px 0
  `],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="mb-3 text-muted">
        <strong>Input Source:</strong> {{ displayedWalk?.walk?.fields?.inputSource | humanise }}
        @if (displayedWalk?.walk?.fields?.migratedFromId) {
          <strong class="ms-2">Migrated From Id:</strong> {{ displayedWalk?.walk?.fields?.migratedFromId}}
        }
        @if (!display.walkPopulationLocal()) {
          <strong class="ms-2">Synced Version:</strong> {{ displayedWalk?.walk?.syncedVersion || "N/A" }}
          <strong class="ms-2">Last
            Synced:</strong> {{ displayedWalk?.walk?.lastSyncedAt ? (displayedWalk?.walk?.lastSyncedAt | displayDateAndTime) : "N/A" }}
        }
      </div>
      @if (walkEvents?.length > 0) {
        <div class="history-accordion">
          @for (event of walkEvents; track event.id; let idx = $index) {
            <div class="history-item" [class.expanded]="detailsOpen(event.id)">
              <div class="history-header" [class.clickable]="hasChangedItems(event)"
                   (click)="hasChangedItems(event) && toggleDetails(event.id)">
                <div class="history-toggle">
                  @if (hasChangedItems(event)) {
                    <app-visibility-toggle-button [expanded]="detailsOpen(event.id)"/>
                  }
                </div>
                <div class="history-date">{{ event.date }}</div>
                <div class="history-member">{{ event.member }}</div>
                <div class="history-event-type">{{ event.eventType }}</div>
                <div class="history-notes">
                  @if (event.data && display.walkPopulationLocal() && event.changes.length > 0) {
                    <fa-icon class="history-revert" [icon]="faRotateLeft"
                             tooltip="Revert to this version" placement="bottom" container="body"
                             (click)="revertToVersion(event); $event.stopPropagation()"/>
                  }
                  {{ event.notes }}
                </div>
              </div>
              @if (detailsOpen(event.id)) {
                <div class="history-details" [class.with-revert]="event.data && display.walkPopulationLocal()">
                  @if (event.changes.length > 0) {
                    <table class="history-changes-table">
                      <thead>
                      <tr>
                        <th style="width: 30%">Field</th>
                        <th style="width: 35%">From</th>
                        <th style="width: 35%">To</th>
                      </tr>
                      </thead>
                      <tbody>
                        @for (change of event.changes; track change.field + "-" + change.to) {
                          <tr>
                            <td>{{ change.field }}</td>
                            <td>{{ change.from }}</td>
                            <td>{{ change.to }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  } @else {
                    <div class="history-no-changes">No field changes recorded.</div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class WalkEditHistoryComponent {
  @Input() displayedWalk!: DisplayedWalk;
  private expandedEventIds = new Set<string>();
  protected readonly faRotateLeft = faRotateLeft;

  private walksReferenceService = inject(WalksReferenceService);
  private memberIdToFullNamePipe = inject(MemberIdToFullNamePipe);
  private displayDateAndTime = inject(DisplayDateAndTimePipe);
  private eventNotePipe = inject(EventNotePipe);
  protected display = inject(WalkDisplayService);
  private groupEventService = inject(GroupEventService);
  private auditDeltaValuePipe = inject(AuditDeltaValuePipe);

  get walkEvents(): DisplayedEvent[] {
    const events = [...(this.displayedWalk?.walk?.events || [])].sort(sortBy("-date"));
    return events.map((event, index) => {
      const changes = this.changesFor(event, events[index + 1]);
      return {
        id: `${event.date}-${event.eventType}-${event.memberId || "system"}`,
        member: this.memberIdToFullNamePipe.transform(event.memberId, this.display.members),
        date: this.displayDateAndTime.transform(event.date),
        eventType: this.walksReferenceService.toWalkEventType(event.eventType)?.description,
        notes: this.notesFor(event, changes),
        changes,
        data: event.data
      };
    });
  }

  revertToVersion(event: DisplayedEvent) {
    if (event.data) {
      AUDITED_FIELDS.forEach(field => {
        const value = this.getNestedValue(event.data, field);
        if (value !== undefined) {
          set(this.displayedWalk.walk, field, value);
        }
      });
    }
  }

  private getNestedValue(obj: object, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  toggleDetails(eventId: string) {
    if (this.expandedEventIds.has(eventId)) {
      this.expandedEventIds.delete(eventId);
    } else {
      this.expandedEventIds.add(eventId);
    }
  }

  detailsOpen(eventId: string): boolean {
    return this.expandedEventIds.has(eventId);
  }

  hasChangedItems(event: DisplayedEvent): boolean {
    return event.changes.length > 0;
  }

  private changesFor(event: WalkEvent, previousEvent?: WalkEvent): ChangedItemDisplay[] {
    if (!event?.data) {
      return [];
    }
    return this.groupEventService.changedItemsBetween(event.data, previousEvent?.data)
      .filter(change => this.isRelevantChange(event, change.fieldName))
      .map(change => ({
        fieldName: change.fieldName,
        field: startCase(change.fieldName.replace(/\./g, " ")),
        from: this.auditDeltaValuePipe.transform(change.previousValue, change.fieldName, this.display.members, "(none)"),
        to: this.auditDeltaValuePipe.transform(change.currentValue, change.fieldName, this.display.members, "(none)")
      }));
  }

  private isRelevantChange(event: WalkEvent, fieldName: string): boolean {
    const relevantFields = this.relevantFieldsForEvent(event.eventType);
    if (!relevantFields.length) {
      return true;
    }
    return relevantFields.some(field => fieldName === field || fieldName.startsWith(`${field}.`));
  }

  private relevantFieldsForEvent(eventType: EventType): string[] {
    if (eventType === EventType.FINISH_TIME_FIXED) {
      return [GroupEventField.END_DATE_TIME];
    } else if (eventType === EventType.LOCATION_GEOCODED) {
      return [
        GroupEventField.START_LOCATION,
        GroupEventField.START_LOCATION_POSTCODE,
        GroupEventField.START_LOCATION_LATITUDE,
        GroupEventField.START_LOCATION_LONGITUDE,
        GroupEventField.START_LOCATION_GRID_REFERENCE_6,
        GroupEventField.START_LOCATION_GRID_REFERENCE_8,
        GroupEventField.START_LOCATION_GRID_REFERENCE_10,
        GroupEventField.START_LOCATION_DESCRIPTION
      ];
    }
    return [];
  }

  private notesFor(event: WalkEvent, changes: ChangedItemDisplay[]): string {
    const pipeResult = this.eventNotePipe.transform(event);
    if (pipeResult) {
      return pipeResult;
    }
    if (changes.length > 0) {
      const fields = changes.map(change => change.field).join(", ");
      return `Changed: ${fields}`;
    }
    const statusChangeNote = this.statusChangeNoteFor(event.eventType);
    if (statusChangeNote) {
      return statusChangeNote;
    }
    if (!event?.data) {
      return "No data snapshot recorded";
    }
    return "No data changes";
  }

  private statusChangeNoteFor(eventType: EventType): string | null {
    const eventTypeDetails = this.walksReferenceService.toWalkEventType(eventType);
    if (!eventTypeDetails?.statusChange) {
      return null;
    }
    return "Changed: Status";
  }
}
