import { Component, inject } from "@angular/core";
import { WalkNotificationDetailsComponent } from "../common/walk-notification-details.component";
import { MarkdownComponent } from "ngx-markdown";
import { LinksService } from "../../../../services/links.service";

@Component({
    selector: "app-meetup-description",
    template: `<p markdown [data]="links?.meetup?.title"></p>`,
    styleUrls: ["./meetup-description.component.sass"],
    imports: [MarkdownComponent]
})
export class MeetupDescriptionComponent extends WalkNotificationDetailsComponent {
  public linksService: LinksService = inject(LinksService);
  links = this.linksService.linksFrom(this.data.walk);
}
