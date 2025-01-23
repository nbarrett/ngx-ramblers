import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-leader-approved",
  template: `
    <p>This message is just to let you know that your walk on <strong [textContent]="walk.walkDate | displayDate"
    ></strong> has been approved and is
    now published on our website!</p>
    @if (event.reason) {
      <p [textContent]="event.reason"></p>
    }
    <p>For info, the details of your walk are as follows:
      <app-walk-notification-details [data]="data"></app-walk-notification-details>
    </p>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>
    `,
  standalone: false
})
export class WalkNotificationLeaderApprovedComponent extends WalkNotificationDetailsComponent {

}
