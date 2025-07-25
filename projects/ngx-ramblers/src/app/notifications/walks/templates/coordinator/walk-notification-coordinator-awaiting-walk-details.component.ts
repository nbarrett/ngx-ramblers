import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";
import { WalkNotificationFooterComponent } from "../common/walk-notification-footer.component";
import { DisplayDateAndTimePipe } from "../../../../pipes/display-date-and-time.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";
import { WalkEventTypePipe } from "../../../../pipes/walk-event-type.pipe";
import { WalkValidationsListPipe } from "../../../../pipes/walk-validations.pipe";

@Component({
    selector: "app-walk-notification-coordinator-awaiting-walk-details",
    template: `
    <p>This email is to notify you that at <strong>{{ event.date | displayDateAndTime }}</strong>, <strong
    [textContent]="event.memberId | memberIdToFullName : members"></strong>
    updated the walk on <strong>{{walk.groupEvent.start_date_time | displayDate"</strong>
    to <strong>{{ event.eventType | walkEventType: 'description' }}</strong>.
    </p>
    @if (walkDataAudit.dataChanged) {
      <div>
        <p>Here are the details that have been completed so far:</p>
        <app-walk-notification-details [data]="data"></app-walk-notification-details>
      </div>
    }
    @if (validationMessages.length > 0) {
      <p><strong>Note:</strong> The Walk can't be approved yet because <span
    [textContent]="validationMessages | asWalkValidationsList"></span>.</p>
    }
    <app-walk-notification-footer [data]="data"></app-walk-notification-footer>
    `,
    imports: [WalkNotificationDetailsComponent, WalkNotificationFooterComponent, DisplayDateAndTimePipe, MemberIdToFullNamePipe, WalkEventTypePipe, WalkValidationsListPipe]
})
export class WalkNotificationCoordinatorAwaitingWalkDetailsComponent extends WalkNotificationDetailsComponent {

}
