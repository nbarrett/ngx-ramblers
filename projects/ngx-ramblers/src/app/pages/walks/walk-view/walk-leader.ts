import { Component, inject, Input } from "@angular/core";
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalkDisplayService } from "../walk-display.service";
import { WalkGroupComponent } from "./walk-group";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { faPersonWalking } from "@fortawesome/free-solid-svg-icons/faPersonWalking";
import { EventLeaderContactLinkComponent } from "./event-leader-contact-link";
import { EventLeaderPhoneLinkComponent } from "./event-leader-phone-link";

@Component({
    selector: "app-walk-leader",
    template: `
    <div class="event-panel rounded event-panel-inner">
      <app-walk-group [displayedWalk]="displayedWalk"/>
      <h1>{{ display.isWalk(displayedWalk?.walk) ? 'Walk Leader' : (display.eventTypeTitle(displayedWalk?.walk) + " Organiser") }}</h1>
      <div>
        <div class="row">
          @if (displayedWalk?.walk?.fields?.contactDetails?.email) {
            <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
              <app-copy-icon [icon]="faEnvelope" title
                             [disabled]="display.isContactUsContact()"
                             [value]="displayedWalk?.walk?.fields?.contactDetails?.email"
                             [elementName]="'email address for '+ displayedWalk?.walk?.fields?.contactDetails?.displayName"/>
              <div content>
                <app-event-leader-contact-link [walk]="displayedWalk?.walk" fallbackLabel="Contact Via Ramblers"/>
              </div>
            </div>
          }
          @if (display.walkContactDetailsPublic()) {
            @if (displayedWalk?.walk?.fields?.contactDetails?.phone) {
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <app-copy-icon [icon]="faPhone" title [value]="displayedWalk?.walk?.fields?.contactDetails?.phone"
                               [elementName]="'mobile number for '+ displayedWalk?.walk?.fields?.contactDetails?.displayName "/>
                <div content>
                  <app-event-leader-phone-link
                    [phone]="displayedWalk?.walk?.fields?.contactDetails?.phone"
                    [displayName]="displayedWalk?.walk?.fields?.contactDetails?.displayName"/>
                </div>
              </div>
            } @else if (!displayedWalk?.walk?.fields?.contactDetails?.email) {
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <app-copy-icon [icon]="faPersonWalking" title
                               [value]="displayedWalk?.walk?.fields?.contactDetails?.displayName"
                               [elementName]="'walk leader '+ displayedWalk?.walk?.fields?.contactDetails?.displayName"/>
                <div content>
                  {{ displayedWalk?.walk?.fields?.contactDetails?.displayName }}
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>`,
  imports: [WalkGroupComponent, RelatedLinkComponent, FontAwesomeModule, CopyIconComponent, EventLeaderContactLinkComponent, EventLeaderPhoneLinkComponent]
})

export class WalkLeaderComponent {

  display = inject(WalkDisplayService);
  faEnvelope = faEnvelope;
  faPhone = faPhone;

  @Input()
  public displayedWalk: DisplayedWalk;

  protected readonly faPersonWalking = faPersonWalking;
}
