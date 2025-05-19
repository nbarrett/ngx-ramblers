import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";
import { WalkNotificationFooterComponent } from "../common/walk-notification-footer.component";
import { DisplayDateAndTimePipe } from "../../../../pipes/display-date-and-time.pipe";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-walk-notification-leader-deleted",
    template: `
    <p>This email is a notification that at <strong [textContent]="event.date | displayDateAndTime"
    ></strong>,
    <strong [textContent]="event.memberId | memberIdToFullName : members"></strong>
    deleted the walk led by <strong
    [textContent]="walk?.fields?.contactDetails?.memberId | memberIdToFullName : members : walk?.fields?.contactDetails?.displayName"></strong>
    on <strong [textContent]="walk.groupEvent.start_date_time | displayDate" ></strong>.
    @if (event.reason) {
      <span [textContent]="event.reason"></span>
    }</p>
    <p>For your information, the walk details were as follows:</p>
    <app-walk-notification-details [data]="data"></app-walk-notification-details>
    <br>
      <app-walk-notification-footer [data]="data"></app-walk-notification-footer>`,
    imports: [WalkNotificationDetailsComponent, WalkNotificationFooterComponent, DisplayDateAndTimePipe, DisplayDatePipe, MemberIdToFullNamePipe]
})
export class WalkNotificationLeaderDeletedComponent extends WalkNotificationDetailsComponent {

}
