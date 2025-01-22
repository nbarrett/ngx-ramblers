import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-coordinator-approved",
  template: `
    <p>This email is a notification that at <strong [textContent]="event.date | displayDateAndTime"></strong>,
      <strong [textContent]="event.memberId | memberIdToFullName : members"></strong>
      approved and published on our website the walk led by <strong
        [textContent]="walk.walkLeaderMemberId | memberIdToFullName : members : walk.displayName"></strong>
      on <strong [textContent]="walk.walkDate | displayDate"></strong>:
    </p>
    <p *ngIf="event.reason" [textContent]="event.reason"></p>
    <p>For info, the details of the walk at the moment is as follows:
      <app-walk-notification-details [data]="data"></app-walk-notification-details>
    </p>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>`,
  standalone: false
})
export class WalkNotificationCoordinatorApprovedComponent extends WalkNotificationDetailsComponent {

}
