import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";

@Component({
  selector: "app-meetup-description",
  templateUrl: "./meetup-description.component.html",
  styleUrls: ["./meetup-description.component.sass"]
})
export class MeetupDescriptionComponent extends WalkNotificationDetailsComponent {
}
