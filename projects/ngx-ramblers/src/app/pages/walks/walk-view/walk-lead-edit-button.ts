import { Component, HostBinding, inject, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faPencil, faPersonWalking } from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalkLeadEditAppearance } from "../../../models/walk-edit-mode.model";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-walk-lead-edit-button",
  imports: [FontAwesomeModule, BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, TooltipDirective],
  styles: [`
    :host
      display: inline-flex
      width: auto
      max-width: none
      white-space: nowrap
    :host.overlay
      position: absolute
      top: 10px
      right: 10px
      z-index: 1000
    :host.action
      display: contents
    :host.compact
      display: inline-flex
      vertical-align: middle
      width: 56px
    :host.compact > .btn.btn-icon
      width: 56px
      min-width: 56px
    :host.compact .walk-lead-edit-split
      width: 56px
    :host.compact .walk-lead-edit-split > .btn:first-child
      flex: 0 0 32px
    :host.compact .walk-lead-edit-caret
      flex: 0 0 24px
      width: 24px
      min-width: 24px
      max-width: 24px
      height: 32px
      min-height: 32px
    .walk-lead-edit-split
      display: inline-flex
      width: auto
      max-width: none
      flex-wrap: nowrap
    .walk-lead-edit-split > .btn + .btn
      margin-left: 0
    .walk-lead-edit-split > .btn:first-child
      flex: 0 1 auto
      border-top-right-radius: 0
      border-bottom-right-radius: 0
    .walk-lead-edit-caret
      position: relative
      display: inline-flex
      align-items: center
      justify-content: center
      box-sizing: border-box
      flex: 0 0 2rem
      width: 2rem
      min-width: 2rem
      max-width: 2rem
      padding: 0
      overflow: hidden
      font-size: 0
      line-height: 0
      border-top-left-radius: 0
      border-bottom-left-radius: 0
      box-shadow: inset 1px 0 0 rgba(0, 0, 0, 0.18)
    .walk-lead-edit-caret::after
      display: none
      content: none
      border: 0
      margin: 0
    .walk-lead-edit-caret fa-icon
      font-size: 0.85rem
      line-height: 1
    .walk-lead-edit-caret-label
      position: absolute
      width: 1px
      height: 1px
      padding: 0
      margin: -1px
      overflow: hidden
      clip: rect(0, 0, 0, 0)
      white-space: nowrap
      border: 0
    .dropdown-menu
      min-width: 0
      width: max-content
  `],
  template: `
    @if (displayedWalk?.walkAccessMode?.walkWritable) {
      @if (display.walkAdminLeadAndEdit(displayedWalk)) {
        <div class="btn-group walk-lead-edit-split"
             [class.btn-group-custom]="appearance === WalkLeadEditAppearance.OVERLAY"
             [class.walk-view-split]="appearance === WalkLeadEditAppearance.ACTION"
             dropdown container="body" placement="bottom right"
             (click)="$event.stopPropagation()">
          <button type="button"
                  [id]="'walkAction-' + displayedWalk?.walk?.id"
                  [class]="primaryButtonClass()"
                  (click)="display.edit(displayedWalk)"
                  [tooltip]="actionTooltip()"
                  [attr.aria-label]="actionTooltip()"
                  container="body">
            <fa-icon [icon]="faPersonWalking"/>
            @if (appearance !== WalkLeadEditAppearance.COMPACT) {
              <span class="ms-2">{{ caption() }}</span>
            }
          </button>
          <button type="button"
                  [class]="splitButtonClass()"
                  dropdownToggle
                  [attr.aria-labelledby]="'walkAction-more-' + displayedWalk?.walk?.id"
                  [attr.aria-controls]="'walkAction-menu-' + displayedWalk?.walk?.id">
            <fa-icon [icon]="faChevronDown"/>
          </button>
          <ul *dropdownMenu class="dropdown-menu dropdown-menu-end"
              [id]="'walkAction-menu-' + displayedWalk?.walk?.id" role="menu">
            <li role="menuitem">
              <button type="button" class="dropdown-item d-flex align-items-center"
                      (click)="display.edit(displayedWalk)">
                <fa-icon [icon]="faPersonWalking" class="me-2"/>{{ caption() }}
              </button>
            </li>
            <li role="menuitem">
              <button type="button" class="dropdown-item d-flex align-items-center"
                      (click)="display.edit(displayedWalk, {bypassLeaderInit: true})">
                <fa-icon [icon]="faPencil" class="me-2"/>{{ editCaption }}
              </button>
            </li>
          </ul>
        </div>
        <span class="walk-lead-edit-caret-label"
              [id]="'walkAction-more-' + displayedWalk?.walk?.id">{{ moreActionsTooltip }}</span>
      } @else {
        <button type="button"
                [id]="'walkAction-' + displayedWalk?.walk?.id"
                [class]="primaryButtonClass()"
                (click)="$event.stopPropagation(); display.edit(displayedWalk)"
                [tooltip]="actionTooltip()"
                [attr.aria-label]="actionTooltip()"
                container="body">
          <fa-icon [icon]="actionIcon()"/>
          @if (appearance !== WalkLeadEditAppearance.COMPACT) {
            <span class="ms-2">{{ caption() }}</span>
          }
        </button>
      }
    }
  `
})
export class WalkLeadEditButton {
  public display = inject(WalkDisplayService);
  protected readonly faChevronDown = faChevronDown;
  protected readonly faPencil = faPencil;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly WalkLeadEditAppearance = WalkLeadEditAppearance;
  protected readonly editCaption = WalksReferenceService.walkAccessModes.edit.caption;
  protected readonly moreActionsTooltip = "More walk actions";
  @Input() displayedWalk: DisplayedWalk;
  @Input() appearance: WalkLeadEditAppearance = WalkLeadEditAppearance.COMPACT;

  @HostBinding("class.overlay")
  get overlayHost(): boolean {
    return this.appearance === WalkLeadEditAppearance.OVERLAY;
  }

  @HostBinding("class.action")
  get actionHost(): boolean {
    return this.appearance === WalkLeadEditAppearance.ACTION;
  }

  @HostBinding("class.compact")
  get compactHost(): boolean {
    return this.appearance === WalkLeadEditAppearance.COMPACT;
  }

  caption(): string {
    return this.displayedWalk?.walkAccessMode?.caption ?? "";
  }

  actionTooltip(): string {
    return `${this.caption()} this walk`;
  }

  actionIcon() {
    return this.caption() === WalksReferenceService.walkAccessModes.lead.caption ? this.faPersonWalking : this.faPencil;
  }

  primaryButtonClass(): string {
    if (this.appearance === WalkLeadEditAppearance.OVERLAY) {
      return "btn pager-btn me-0";
    } else if (this.appearance === WalkLeadEditAppearance.ACTION) {
      return "btn btn-primary btn-sm walk-view-action";
    } else {
      return "btn btn-primary btn-icon";
    }
  }

  splitButtonClass(): string {
    if (this.appearance === WalkLeadEditAppearance.OVERLAY) {
      return "btn pager-btn walk-lead-edit-caret dropdown-toggle";
    } else if (this.appearance === WalkLeadEditAppearance.ACTION) {
      return "btn btn-primary btn-sm walk-view-action walk-lead-edit-caret dropdown-toggle";
    } else {
      return "btn btn-primary btn-icon walk-lead-edit-caret dropdown-toggle";
    }
  }
}
