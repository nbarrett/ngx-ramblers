import { Component, Input, OnDestroy, ViewChild, ViewEncapsulation } from "@angular/core";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export interface ContactAction {
  label: string;
  icon: IconDefinition;
  tooltip: string;
  href?: string;
  target?: string;
  onClick?: () => void;
}

@Component({
  selector: "app-contact-action-dropdown",
  encapsulation: ViewEncapsulation.None,
  styles: [`
    app-contact-action-dropdown
      position: relative

    app-contact-action-dropdown .contact-dropdown
      position: relative
      display: inline-block

    .contact-action-dropdown-menu
      margin-bottom: -2px
      background-color: #eeeeee
      border: 1px solid #ddd

    .contact-action-dropdown-menu .dropdown-item
      text-decoration: none !important
      background-image: none !important
      background-color: #eeeeee
      font-weight: bold
      color: inherit
  `],
  template: `
    <div class="contact-dropdown" dropdown dropup container="body"
         (mouseenter)="showDropdown()" (mouseleave)="scheduleHide()"
         #dropdownRef="bs-dropdown">
      <a dropdownToggle class="tooltip-link">
        <ng-content/>
      </a>
      <ul *dropdownMenu class="dropdown-menu contact-action-dropdown-menu"
          (mouseenter)="showDropdown()" (mouseleave)="scheduleHide()">
        @for (action of actions; track action.label) {
          <li>
            @if (action.onClick) {
              <a class="dropdown-item" href="javascript:void(0)"
                 (click)="invoke($event, action)"
                 container="body" [tooltip]="action.tooltip" placement="left">
                <fa-icon [icon]="action.icon" class="fa-icon me-2"/>{{ action.label }}
              </a>
            } @else {
              <a class="dropdown-item"
                 [href]="action.href"
                 [target]="action.target || '_self'"
                 container="body" [tooltip]="action.tooltip" placement="left">
                <fa-icon [icon]="action.icon" class="fa-icon me-2"/>{{ action.label }}
              </a>
            }
          </li>
        }
      </ul>
    </div>
  `,
  imports: [TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, FontAwesomeModule]
})
export class ContactActionDropdownComponent implements OnDestroy {
  @Input() actions: ContactAction[] = [];

  private showTimeout: ReturnType<typeof setTimeout>;
  private hideTimeout: ReturnType<typeof setTimeout>;
  @ViewChild("dropdownRef") dropdownRef: BsDropdownDirective;

  invoke(event: MouseEvent, action: ContactAction) {
    event.preventDefault();
    action.onClick?.();
    this.dropdownRef?.hide();
  }

  showDropdown() {
    clearTimeout(this.hideTimeout);
    clearTimeout(this.showTimeout);
    this.showTimeout = setTimeout(() => {
      this.dropdownRef?.show();
    }, 350);
  }

  scheduleHide() {
    clearTimeout(this.showTimeout);
    this.hideTimeout = setTimeout(() => {
      this.dropdownRef?.hide();
    }, 200);
  }

  ngOnDestroy() {
    clearTimeout(this.showTimeout);
    clearTimeout(this.hideTimeout);
  }
}
