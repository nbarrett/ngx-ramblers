import { Component, inject, Input } from "@angular/core";
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalkDisplayService } from "../walk-display.service";
import { EventGroupComponent } from "./event-group";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { faPersonWalking } from "@fortawesome/free-solid-svg-icons/faPersonWalking";
import { EventLeaderContactLinkComponent } from "./event-leader-contact-link";
import { EventLeaderPhoneLinkComponent } from "./event-leader-phone-link";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

@Component({
    selector: "app-event-leader",
    template: `
    <div class="event-panel rounded event-panel-inner">
      <app-event-group [displayedWalk]="displayedWalk" [groupEvent]="groupEvent"/>
      <h1>{{ heading() }}</h1>
      <div>
        <div class="row">
          @if (resolvedEvent()?.fields?.contactDetails?.email) {
            <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
              <app-copy-icon [icon]="faEnvelope" title
                             [disabled]="display.isContactUsContact()"
                             [value]="resolvedEvent()?.fields?.contactDetails?.email"
                             [elementName]="'email address for '+ resolvedEvent()?.fields?.contactDetails?.displayName"/>
              <div content>
                <app-event-leader-contact-link [walk]="resolvedEvent()" fallbackLabel="Contact Via Ramblers"/>
              </div>
            </div>
          }
          @if (display.walkContactDetailsPublic()) {
            @if (resolvedEvent()?.fields?.contactDetails?.phone) {
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <app-copy-icon [icon]="faPhone" title [value]="resolvedEvent()?.fields?.contactDetails?.phone"
                               [elementName]="'mobile number for '+ resolvedEvent()?.fields?.contactDetails?.displayName "/>
                <div content>
                  <app-event-leader-phone-link
                    [phone]="resolvedEvent()?.fields?.contactDetails?.phone"
                    [displayName]="resolvedEvent()?.fields?.contactDetails?.displayName"/>
                </div>
              </div>
            } @else if (!resolvedEvent()?.fields?.contactDetails?.email) {
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <app-copy-icon [icon]="faPersonWalking" title
                               [value]="resolvedEvent()?.fields?.contactDetails?.displayName"
                               [elementName]="'walk leader '+ resolvedEvent()?.fields?.contactDetails?.displayName"/>
                <div content>
                  {{ resolvedEvent()?.fields?.contactDetails?.displayName }}
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>`,
  imports: [EventGroupComponent, RelatedLinkComponent, FontAwesomeModule, CopyIconComponent, EventLeaderContactLinkComponent, EventLeaderPhoneLinkComponent]
})

export class EventLeaderComponent {

  display = inject(WalkDisplayService);
  faEnvelope = faEnvelope;
  faPhone = faPhone;

  @Input()
  public displayedWalk: DisplayedWalk;

  @Input()
  public groupEvent: ExtendedGroupEvent;

  protected readonly faPersonWalking = faPersonWalking;

  resolvedEvent(): ExtendedGroupEvent {
    return this.groupEvent || this.displayedWalk?.walk;
  }

  heading(): string {
    const event = this.resolvedEvent();
    if (this.displayedWalk && this.display.isWalk(event)) {
      return "Walk Leader";
    }
    return (this.display.eventTypeTitle(event) || "Event") + " Organiser";
  }
}
