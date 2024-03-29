import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-coordinator-awaiting-walk-details",
  template: `
    <p>This email is to notify you that at <strong>{{ event.date | displayDateAndTime }}</strong>, <strong
      [textContent]="event.memberId | memberIdToFullName : members"></strong>
      updated the walk on <strong>{{walk.walkDate | displayDate"</strong>
      to <strong>{{ event.eventType | walkEventType: 'description' }}</strong>.
    </p>
    <div *ngIf="walkDataAudit.dataChanged">
      <p>Here are the details that have been completed so far:</p>
      <app-walk-notification-details [data]="data"></app-walk-notification-details>
    </div>
    <p *ngIf="validationMessages.length > 0"><strong>Note:</strong> The Walk can't be approved yet because <span
      [textContent]="validationMessages | asWalkValidationsList"></span>.</p>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>
  `
})
export class WalkNotificationCoordinatorAwaitingWalkDetailsComponent extends WalkNotificationDetailsComponent {

}
