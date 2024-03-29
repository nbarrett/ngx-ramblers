import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-coordinator-awaiting-approval",
  template: `
    <p>This email is a notification that at <strong>{{ event.date | displayDateAndTime }}</strong>,
      <strong>{{ event.memberId | memberIdToFullName : members }}</strong>
      completed all details on the walk led by
      <strong>{{ walk.walkLeaderMemberId | memberIdToFullName : members : walk.displayName }}</strong>
      on <strong>{{ walk.walkDate | displayDate }}</strong> and now awaits your approval.
      For your information, the walk details are as follows:</p>
    <app-walk-notification-details [data]="data"></app-walk-notification-details>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>
  `
})
export class WalkNotificationCoordinatorAwaitingApprovalComponent extends WalkNotificationDetailsComponent {

}
