import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "./walk-notification-details.component";
import { LinkComponent } from "../../../../link/link";

@Component({
    selector: "app-walk-notification-footer",
    template: `
      <p>
        Click
        <app-link area="walks"
                  id="{{stringUtils.lastItemFrom(walk?.groupEvent?.url) || this.stringUtils.kebabCase(walk?.groupEvent?.title) || walk?.groupEvent?.id || walk?.id}}"
                  text="here"/>
        to see the details of the above walk, or to make changes to it if you are logged in.
        Alternatively, you can reply to this mail and I'll make any changes for you.
      </p>
      <p>
        Best regards
      </p>`,
    imports: [LinkComponent]
})
export class WalkNotificationFooterComponent extends WalkNotificationDetailsComponent {

}
