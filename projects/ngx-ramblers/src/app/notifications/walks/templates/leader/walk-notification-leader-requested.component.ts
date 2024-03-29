import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-leader-requested",
  template: `
    <p>Thanks again for offering to lead the walk on <strong [textContent]="walk.walkDate | displayDate"
                                                             ></strong>!</p>
    <p>Before I can publish your walk, I need more information from you as <strong
      [textContent]="validationMessages | asWalkValidationsList"></strong>
    <p *ngIf="event.reason" [textContent]="event.reason"></p>
    <p>For info, the details of your walk at the moment are as follows:
      <app-walk-notification-details [data]="data"></app-walk-notification-details>
    </p>
    <p>When you get a moment, please could you complete the above information either directly on the site or by
      emailing me.
      I'll then give it a quick check, mark it as approved, and then it will be published on our walks programme for
      all to see.</p>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>`
})
export class WalkNotificationLeaderRequestedComponent extends WalkNotificationDetailsComponent {

}
