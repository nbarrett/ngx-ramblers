import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-meetup-description",
  template: `<p markdown [data]="walk.meetupEventDescription"></p>`,
  styleUrls: ["./meetup-description.component.sass"]
})
export class MeetupDescriptionComponent extends WalkNotificationDetailsComponent {
}
