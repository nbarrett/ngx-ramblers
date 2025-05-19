import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";
import { WalkNotificationFooterComponent } from "../common/walk-notification-footer.component";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { WalkValidationsListPipe } from "../../../../pipes/walk-validations.pipe";

@Component({
    selector: "app-walk-notification-coordinator-requested",
    template: `
    <p>Thanks again for offering to lead the walk on <strong [textContent]="walk.groupEvent.start_date_time | displayDate"></strong>!</p>
    <p>Before I can publish your walk, I need more information from you as <strong
    [textContent]="validationMessages | asWalkValidationsList"></strong>
    @if (event.reason) {
      <p [textContent]="event.reason"></p>
    }
    <p>For info, the details of your walk at the moment are as follows:
      <app-walk-notification-details [data]="data"></app-walk-notification-details>
    </p>
    <p>When you get a moment, please could you complete the above information either directly on the site or by emailing
      me.
      I'll then give it a quick check, mark it as approved, and then it will be published on our walks programme for all
    to see.</p>
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>`,
    imports: [WalkNotificationDetailsComponent, WalkNotificationFooterComponent, DisplayDatePipe, WalkValidationsListPipe]
})
export class WalkNotificationCoordinatorRequestedComponent extends WalkNotificationDetailsComponent {

}
