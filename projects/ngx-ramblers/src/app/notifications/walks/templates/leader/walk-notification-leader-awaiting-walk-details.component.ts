import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-leader-awaiting-walk-details",
  template: `
    <p>Thanks for offering to lead the walk on <strong [textContent]="walk.walkDate | displayDate"
                                                       ></strong>!</p>
    <div *ngIf="walkDataAudit.dataChanged">
      <p>Here are the details that have been completed so far:</p>
      <app-walk-notification-changes [data]="data"/>
    </div>
    <p *ngIf="validationMessages.length > 0"><strong>Note:</strong> Before I can publish your walk on our walks
      programme, I need more information from you as
      <span [textContent]="validationMessages | asWalkValidationsList"></span>.</p>
    <app-walk-notification-footer [data]="data"/>`
})
export class WalkNotificationLeaderAwaitingWalkDetailsComponent extends WalkNotificationDetailsComponent {

}
