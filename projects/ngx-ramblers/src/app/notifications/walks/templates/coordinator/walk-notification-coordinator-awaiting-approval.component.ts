import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";
import { WalkNotificationFooterComponent } from "../common/walk-notification-footer.component";
import { DisplayDateAndTimePipe } from "../../../../pipes/display-date-and-time.pipe";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-walk-notification-coordinator-awaiting-approval",
    template: `
    <p>This email is a notification that at <strong>{{ event.date | displayDateAndTime }}</strong>,
      <strong>{{ event.memberId | memberIdToFullName : members }}</strong>
      completed all details on the walk led by
      <strong>{{ walk?.fields?.contactDetails?.memberId | memberIdToFullName : members : walk?.fields?.contactDetails?.displayName }}</strong>
      on <strong>{{ walk.groupEvent.start_date_time | displayDate }}</strong> and now awaits your approval.
      For your information, the walk details are as follows:</p>
    <app-walk-notification-details [data]="data"></app-walk-notification-details>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>
  `,
    imports: [WalkNotificationDetailsComponent, WalkNotificationFooterComponent, DisplayDateAndTimePipe, DisplayDatePipe, MemberIdToFullNamePipe]
})
export class WalkNotificationCoordinatorAwaitingApprovalComponent extends WalkNotificationDetailsComponent {

}
