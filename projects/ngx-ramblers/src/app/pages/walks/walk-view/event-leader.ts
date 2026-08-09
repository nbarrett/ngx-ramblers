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
import { WalkShareRowComponent } from "./walk-share-row";
import { JointLeaderNamesPipe } from "../../../pipes/joint-leader-names.pipe";

@Component({
    selector: "app-event-leader",
    styles: [`
      :host
        display: block

      :host-context(.walk-meta-top-left),
      :host-context(.walk-meta-left)
        display: flex
        flex-direction: column
        flex: 1 0 auto
        align-self: stretch
        min-height: min-content

      .event-panel-inner
        margin-bottom: 0

      :host-context(.walk-meta-top-left) .event-panel,
      :host-context(.walk-meta-left) .event-panel
        display: flex
        flex-direction: column
        flex: 1 0 auto
        box-sizing: border-box
        min-height: 100%
    `],
    template: `
    <div class="event-panel rounded event-panel-inner">
      <app-event-group [displayedWalk]="displayedWalk" [groupEvent]="groupEvent"/>
      <div class="row">
        @if (hasVisibleContactDetails()) {
        <div class="col-md-6">
          <h1>{{ heading() }}</h1>
          <div class="row">
            @if (display.hasContactLink(resolvedEvent())) {
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <app-copy-icon [icon]="faEnvelope" title
                               [disabled]="!display.showMailtoEmail(resolvedEvent())"
                               [value]="display.showMailtoEmail(resolvedEvent()) ? resolvedEvent()?.fields?.contactDetails?.email : null"
                               [elementName]="'email address for '+ (display.visibleLeaderDisplayName(resolvedEvent()) || 'event leader')"/>
                <div content>
                  <app-event-leader-contact-link [walk]="resolvedEvent()"
                                                 [fallbackLabel]="display.contactLinkFallbackLabel(resolvedEvent())"/>
                </div>
              </div>
            }
            @if (display.contactPhoneVisible(resolvedEvent()) && resolvedEvent()?.fields?.contactDetails?.phone) {
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <app-copy-icon [icon]="faPhone" title [value]="resolvedEvent()?.fields?.contactDetails?.phone"
                               [elementName]="'mobile number for '+ (display.visibleLeaderDisplayName(resolvedEvent()) || 'event leader')"/>
                <div content>
                  <app-event-leader-phone-link
                    [phone]="resolvedEvent()?.fields?.contactDetails?.phone"
                    [displayName]="display.visibleLeaderDisplayName(resolvedEvent())"/>
                </div>
              </div>
            } @else if (display.contactNameVisible(resolvedEvent()) && resolvedEvent()?.fields?.contactDetails?.displayName
              && !display.hasContactLink(resolvedEvent())) {
              <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
                <app-copy-icon [icon]="faPersonWalking" title
                               [value]="resolvedEvent()?.fields?.contactDetails?.displayName"
                               [elementName]="'walk leader '+ resolvedEvent()?.fields?.contactDetails?.displayName"/>
                <div content>
                  @for (name of resolvedEvent()?.fields?.contactDetails?.displayName | jointLeaderNames; track $index) {
                    <span class="d-block">{{ name }}</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
        }
        @if (display.showWalkShareInHeader() && displayedWalk?.walkLink) {
          <div class="col-md-6">
            <h1>Sharing</h1>
            <div class="row">
              <app-walk-share-row [displayedWalk]="displayedWalk"
                                  [label]="'Share this ' + display.eventTypeTitle(resolvedEvent())"/>
            </div>
          </div>
        }
      </div>
    </div>`,
  imports: [EventGroupComponent, RelatedLinkComponent, FontAwesomeModule, CopyIconComponent, EventLeaderContactLinkComponent, EventLeaderPhoneLinkComponent, WalkShareRowComponent, JointLeaderNamesPipe]
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

  hasVisibleContactDetails(): boolean {
    return this.display.hasVisibleLeaderContactDetails(this.resolvedEvent());
  }

  heading(): string {
    const event = this.resolvedEvent();
    return (this.display.eventTypeTitle(event) || "Group Walk") + " Leader";
  }
}
