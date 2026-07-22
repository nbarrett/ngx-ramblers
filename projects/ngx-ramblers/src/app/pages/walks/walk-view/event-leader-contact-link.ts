import { Component, inject, Input } from "@angular/core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { EventContactService } from "../../../services/walks-and-events/event-contact.service";
import { JointLeaderNamesPipe } from "../../../pipes/joint-leader-names.pipe";

@Component({
  selector: "app-event-leader-contact-link",
  template: `
    @if (eventContact.eventLeaderContactHref(walk)) {
      <a [href]="eventContact.eventLeaderContactHref(walk)"
         [target]="eventContact.isRamblersWebsiteContact(walk) ? '_blank' : '_self'"
         container="body" [tooltip]="eventContact.eventLeaderContactTooltip(walk)">
        @for (name of displayName | jointLeaderNames; track $index) {
          <span class="d-block">{{ name }}</span>
        }
      </a>
    } @else if (eventContact.isContactUsContact(walk)) {
      <a class="tooltip-link"
         (click)="eventContact.contactEventLeader(walk)"
         container="body" [tooltip]="eventContact.eventLeaderContactTooltip(walk)">
        @for (name of displayName | jointLeaderNames; track $index) {
          <span class="d-block">{{ name }}</span>
        }
      </a>
    } @else {
      <span>
        @for (name of displayName | jointLeaderNames; track $index) {
          <span class="d-block">{{ name }}</span>
        }
      </span>
    }`,
  imports: [TooltipDirective, JointLeaderNamesPipe]
})
export class EventLeaderContactLinkComponent {

  eventContact = inject(EventContactService);

  @Input() walk: ExtendedGroupEvent;
  @Input() fallbackLabel = "";

  get displayName(): string {
    return this.walk?.fields?.contactDetails?.displayName || this.fallbackLabel;
  }
}
