import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";
import { WalkNotificationFooterComponent } from "../common/walk-notification-footer.component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";

@Component({
    selector: "app-walk-notification-leader-awaiting-approval",
    template: `
    <p>Thanks for completing all details on the walk you've agreed to lead on <strong
      [textContent]="walk.groupEvent.start_date_time | displayDate" ></strong>!</p>
    <p>This email is just to confirm that the walk details are as follows:</p>
    <app-walk-notification-details [data]="data"></app-walk-notification-details>
    <p>As soon as I've given it the once over, I'll mark it as approved and then it will be published on our walks
      programme.</p>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>`,
    imports: [WalkNotificationDetailsComponent, WalkNotificationFooterComponent, DisplayDatePipe]
})
export class WalkNotificationLeaderAwaitingApprovalComponent extends WalkNotificationDetailsComponent {

}
