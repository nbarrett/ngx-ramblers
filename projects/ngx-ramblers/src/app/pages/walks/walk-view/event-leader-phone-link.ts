import { Component, inject, Input, OnDestroy, ViewChild, ViewEncapsulation } from "@angular/core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faPhone, faComment } from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { WalkDisplayService } from "../walk-display.service";
import { WalkLeaderPhoneAction } from "../../../models/system.model";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

@Component({
  selector: "app-event-leader-phone-link",
  encapsulation: ViewEncapsulation.None,
  styles: [`
    app-event-leader-phone-link
      position: relative

    app-event-leader-phone-link .phone-dropdown
      position: relative
      display: inline-block

    .phone-action-dropdown-menu
      margin-bottom: -2px
      background-color: #eeeeee
      border: 1px solid #ddd

    .phone-action-dropdown-menu .dropdown-item
      text-decoration: none !important
      background-image: none !important
      background-color: #eeeeee
      font-weight: bold
      color: inherit
  `],
  template: `
    <div class="phone-dropdown" dropdown dropup container="body"
         (mouseenter)="showDropdown()" (mouseleave)="scheduleHide()"
         #dropdownRef="bs-dropdown">
      <a dropdownToggle class="tooltip-link">
        {{ phone }}
      </a>
      <ul *dropdownMenu class="dropdown-menu phone-action-dropdown-menu"
          (mouseenter)="showDropdown()" (mouseleave)="scheduleHide()">
        @for (action of display.phoneActions(); track action) {
          <li>
            <a class="dropdown-item"
               [href]="display.phoneActionHref(phone, action)"
               [target]="action === whatsapp ? '_blank' : '_self'"
               container="body" [tooltip]="display.phoneActionTooltip(displayName, phone, action)"
               placement="left">
              <fa-icon [icon]="iconFor(action)" class="fa-icon me-2"/>{{ display.phoneActionLabel(action) }}
            </a>
          </li>
        }
      </ul>
    </div>`,
  imports: [TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, FontAwesomeModule]
})
export class EventLeaderPhoneLinkComponent implements OnDestroy {

  display = inject(WalkDisplayService);

  @Input() phone: string;
  @Input() displayName: string;

  protected readonly whatsapp = WalkLeaderPhoneAction.WHATSAPP;
  private hideTimeout: ReturnType<typeof setTimeout>;
  @ViewChild("dropdownRef") dropdownRef: BsDropdownDirective;

  iconFor(action: WalkLeaderPhoneAction): IconDefinition {
    if (action === WalkLeaderPhoneAction.WHATSAPP) {
      return faWhatsapp;
    } else if (action === WalkLeaderPhoneAction.SMS) {
      return faComment;
    }
    return faPhone;
  }

  showDropdown() {
    clearTimeout(this.hideTimeout);
    this.dropdownRef?.show();
  }

  scheduleHide() {
    this.hideTimeout = setTimeout(() => {
      this.dropdownRef?.hide();
    }, 200);
  }

  ngOnDestroy() {
    clearTimeout(this.hideTimeout);
  }
}
