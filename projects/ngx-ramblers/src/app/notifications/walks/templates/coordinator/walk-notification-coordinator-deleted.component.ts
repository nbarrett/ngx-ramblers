import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-coordinator-deleted",
  template: `
    <p>This email is a notification that at <strong [textContent]="event.date | displayDateAndTime"></strong>,
      <strong [textContent]="event.memberId | memberIdToFullName : members"></strong>
      deleted the walk led by <strong
        [textContent]="walk.walkLeaderMemberId | memberIdToFullName : members : walk.displayName"></strong>
      on <strong [textContent]="walk.walkDate | displayDate"></strong>.
      <span *ngIf="event.reason" [textContent]="event.reason"></span></p>
    <p>For your information, the walk details were as follows:</p>
    <app-walk-notification-details [data]="data"></app-walk-notification-details>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>`,
  standalone: false
})
export class WalkNotificationCoordinatorDeletedComponent extends WalkNotificationDetailsComponent {

}
