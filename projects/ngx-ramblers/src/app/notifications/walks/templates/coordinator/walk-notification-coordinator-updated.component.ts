import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-walk-notification-coordinator-updated",
  template: `
    <p>This email is a notification that at <strong [textContent]="event.date | displayDateAndTime"></strong>,
      <strong [textContent]="event.memberId | memberIdToFullName : members"></strong>
      made the following changes to the walk led by <strong
        [textContent]="walk.walkLeaderMemberId | memberIdToFullName : members : walk.displayName"></strong>
      on <strong [textContent]="walk.walkDate | displayDate"></strong>:
    </p>
    <app-walk-notification-changes [data]="data"/>
    <p *ngIf="event.reason" [textContent]="event.reason"></p>
    <p *ngIf="validationMessages.length > 0"><strong>Note:</strong> The Walk can't be approved yet because <span
      [textContent]="validationMessages | asWalkValidationsList"></span>.</p>
    <p *ngIf="walk.ramblersWalkId"><strong>Note:</strong> Now the walk is published on Ramblers, if you or <strong
      [textContent]="walk.walkLeaderMemberId | memberIdToFullName : members : walk.displayName"></strong> makes
      any further changes to this walk,
      you will need to decide whether to re-publish <a [href]="display.ramblersLink(walk)">this
        walk on the Ramblers site</a>.</p>
    <app-walk-notification-footer [data]="data"/>`
})
export class WalkNotificationCoordinatorUpdatedComponent extends WalkNotificationDetailsComponent {

}
