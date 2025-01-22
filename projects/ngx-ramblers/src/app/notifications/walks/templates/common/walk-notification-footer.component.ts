import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "./walk-notification-details.component";

@Component({
  selector: "app-walk-notification-footer",
  template: `
    <p>
      Click
      <app-link area="walks" id="{{walk.id}}" text="here"></app-link>
      to see the details of the above walk, or to make changes to it if you are logged in.
      Alternatively, you can reply to this mail and I'll make any changes for you.
    </p>
    <p>
      Best regards
    </p>`,
  standalone: false
})
export class WalkNotificationFooterComponent extends WalkNotificationDetailsComponent {

}
