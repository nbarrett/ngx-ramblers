import { Component, inject, Input } from "@angular/core";
import { DisplayedWalk } from "../../../models/walk.model";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { WalkDisplayService } from "../walk-display.service";
import { DisplayedEvent } from "../../../models/walk-displayed-event.model";
import { MemberIdToFullNamePipe } from "../../../pipes/member-id-to-full-name.pipe";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { EventNotePipe } from "../../../pipes/event-note.pipe";
import { ChangedItemsPipe } from "../../../pipes/changed-items.pipe";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";

@Component({
  selector: "app-walk-edit-history",
  standalone: true,
  imports: [
    TooltipDirective
  ],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="form-group">
        <table
          class="round styled-table table-striped table-hover table-sm table-pointer">
          <thead>
          <tr>
            <th>Date</th>
            <th>Who</th>
            <th>Description</th>
            <th>Notes</th>
          </tr>
          </thead>
          <tbody>
            @for (event of walkEvents; track event.date) {
              <tr>
                <td style="width: 25%" [textContent]="event.date"></td>
                <td style="width: 15%"
                    [textContent]="event.member"></td>
                <td style="width: 20%"
                    [textContent]="event.eventType"></td>
                <td style="width: 40%"><span
                  tooltip="Details: {{event.changedItems}}">{{ event.notes }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class WalkEditHistoryComponent {
  @Input() displayedWalk!: DisplayedWalk;

  private walksReferenceService = inject(WalksReferenceService);
  private memberIdToFullNamePipe = inject(MemberIdToFullNamePipe);
  private displayDateAndTime = inject(DisplayDateAndTimePipe);
  private eventNotePipe = inject(EventNotePipe);
  private changedItemsPipe = inject(ChangedItemsPipe);
  private display = inject(WalkDisplayService);

  get walkEvents(): DisplayedEvent[] {
    return this.displayedWalk?.walk?.events
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((event) => ({
        member: this.memberIdToFullNamePipe.transform(event.memberId, this.display.members),
        date: this.displayDateAndTime.transform(event.date),
        eventType: this.walksReferenceService.toWalkEventType(event.eventType)?.description,
        notes: this.eventNotePipe.transform(event),
        changedItems: this.changedItemsPipe.transform(event, this.display.members)
      }));
  }
}
