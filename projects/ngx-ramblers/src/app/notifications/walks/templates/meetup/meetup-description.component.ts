import { Component } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";
import { MarkdownComponent } from "ngx-markdown";

@Component({
    selector: "app-meetup-description",
    template: `<p markdown [data]="walk.meetupEventDescription"></p>`,
    styleUrls: ["./meetup-description.component.sass"],
    imports: [MarkdownComponent]
})
export class MeetupDescriptionComponent extends WalkNotificationDetailsComponent {
}
