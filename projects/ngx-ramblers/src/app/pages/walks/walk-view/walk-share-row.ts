import { Component, inject, Input, OnDestroy, ViewChild } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCopy, faEye, faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalkDisplayService } from "../walk-display.service";
import { WalkShareService } from "../walk-share.service";
import { NotifierService, AlertInstance } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { RelatedLinkComponent } from "../../../modules/common/related-links/related-link";

@Component({
  selector: "app-walk-share-row",
  template: `
    <div app-related-link [mediaWidth]="display.relatedLinksMediaWidth" class="col-sm-12">
      <fa-icon title [icon]="faShareNodes"
               class="fa-icon colour-mintcake share-icon"
               tooltip="Share this {{display.eventTypeTitle(displayedWalk?.walk)}}"
               role="button" (click)="shareWalk()"></fa-icon>
      <div content class="walk-link-dropdown" dropdown dropup container="body"
           (mouseenter)="showDropdown()" (mouseleave)="scheduleHide()"
           #walkLinkDropdown="bs-dropdown">
        <a dropdownToggle class="tooltip-link rams-text-decoration-pink walk-link-toggle">
          {{ label || defaultLabel() }}
        </a>
        <ul *dropdownMenu class="dropdown-menu walk-link-dropdown-menu"
            (mouseenter)="showDropdown()" (mouseleave)="scheduleHide()">
          <li>
            <a class="dropdown-item" [href]="displayedWalk?.walkLink" target="_blank">
              <fa-icon [icon]="faEye" class="fa-icon me-2"/>View this {{ display.eventTypeTitle(displayedWalk?.walk).toLowerCase() }}
            </a>
          </li>
          <li>
            <a class="dropdown-item walk-link-action" role="button" (click)="shareWalk()">
              <fa-icon [icon]="faShareNodes" class="fa-icon me-2"/>Share this {{ display.eventTypeTitle(displayedWalk?.walk).toLowerCase() }}
            </a>
          </li>
          <li>
            <a class="dropdown-item walk-link-action" role="button" (click)="copyLink()">
              <fa-icon [icon]="faCopy" class="fa-icon me-2"/>Copy link
            </a>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .share-icon
      cursor: pointer

    .walk-link-dropdown
      position: relative
      display: inline-block

    .walk-link-toggle
      cursor: pointer

    .walk-link-dropdown-menu
      margin-bottom: -2px
      background-color: #eeeeee
      border: 1px solid #ddd

    .walk-link-dropdown-menu .dropdown-item
      text-decoration: none !important
      background-image: none !important
      background-color: #eeeeee
      font-weight: bold
      color: inherit

    .walk-link-dropdown-menu .walk-link-action
      cursor: pointer
  `],
  imports: [FontAwesomeModule, TooltipDirective, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, RelatedLinkComponent]
})
export class WalkShareRowComponent implements OnDestroy {

  public display = inject(WalkDisplayService);
  private walkShareService = inject(WalkShareService);
  private notifierService = inject(NotifierService);
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private hideTimeout: ReturnType<typeof setTimeout>;
  @ViewChild("walkLinkDropdown") walkLinkDropdown?: BsDropdownDirective;
  @Input() displayedWalk: DisplayedWalk;
  @Input() label?: string;
  protected readonly faShareNodes = faShareNodes;
  protected readonly faEye = faEye;
  protected readonly faCopy = faCopy;

  ngOnDestroy(): void {
    clearTimeout(this.hideTimeout);
  }

  defaultLabel(): string {
    return `This ${this.display.eventTypeTitle(this.displayedWalk?.walk)}`;
  }

  showDropdown(): void {
    clearTimeout(this.hideTimeout);
    this.walkLinkDropdown?.show();
  }

  scheduleHide(): void {
    this.hideTimeout = setTimeout(() => {
      this.walkLinkDropdown?.hide();
    }, 200);
  }

  shareWalk(): Promise<void> {
    return this.walkShareService.shareWalk(this.displayedWalk, this.notify);
  }

  copyLink(): Promise<void> {
    return this.walkShareService.copyLink(this.displayedWalk, this.notify);
  }
}
