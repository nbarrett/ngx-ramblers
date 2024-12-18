import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-leader-updated",
  template: `
    <p>Thanks again for offering to lead the walk on <strong [textContent]="walk.walkDate | displayDate"></strong>!</p>
    <p>This email is a notification that at <strong [textContent]="event.date | displayDateAndTime"></strong>,
      <strong [textContent]="event.memberId | memberIdToFullName : members"></strong>
      made the following changes to your walk:
    </p>
    <app-walk-notification-changes [data]="data"/>
    <p *ngIf="validationMessages.length > 0"><strong>Note:</strong> Before I can publish your walk on our walks
      programme, I need more information from you as
      <span [textContent]="validationMessages | asWalkValidationsList"></span>.</p>
    <p *ngIf="event.reason" [textContent]="event.reason"></p>
    <app-walk-notification-footer [data]="data"/>`
})
export class WalkNotificationLeaderUpdatedComponent extends WalkNotificationDetailsComponent {

}
