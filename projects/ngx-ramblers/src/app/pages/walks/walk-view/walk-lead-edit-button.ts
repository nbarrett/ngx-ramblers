import { Component, HostBinding, inject, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faPencil, faPersonWalking } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalkLeadEditAction, WalkLeadEditAppearance } from "../../../models/walk-edit-mode.model";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalkDisplayService } from "../walk-display.service";
import { ButtonDropdownComponent } from "../../../modules/common/button-dropdown/button-dropdown";
import { ButtonDropdownContainer, ButtonDropdownItem, ButtonDropdownPlacement } from "../../../models/button-dropdown.model";

@Component({
  selector: "app-walk-lead-edit-button",
  imports: [FontAwesomeModule, TooltipDirective, ButtonDropdownComponent],
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
    :host.compact app-button-dropdown
      width: 56px
  `],
  template: `
    @if (displayedWalk?.walkAccessMode?.walkWritable) {
      @if (display.walkAdminLeadAndEdit(displayedWalk)) {
        <app-button-dropdown [class.walk-view-split]="appearance === WalkLeadEditAppearance.ACTION"
                             [label]="appearance === WalkLeadEditAppearance.COMPACT ? null : caption()"
                             [icon]="faPersonWalking"
                             [buttonClass]="primaryButtonClass()"
                             [tooltip]="actionTooltip()"
                             [ariaLabel]="actionTooltip()"
                             [container]="ButtonDropdownContainer.BODY"
                             [placement]="ButtonDropdownPlacement.BOTTOM_RIGHT"
                             menuEnd
                             [items]="leadEditItems()"
                             (itemSelect)="onLeadEdit($event)"
                             (click)="$event.stopPropagation()"/>
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
  protected readonly faPencil = faPencil;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly WalkLeadEditAppearance = WalkLeadEditAppearance;
  protected readonly ButtonDropdownContainer = ButtonDropdownContainer;
  protected readonly ButtonDropdownPlacement = ButtonDropdownPlacement;
  protected readonly editCaption = WalksReferenceService.walkAccessModes.edit.caption;
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

  protected leadEditItems(): ButtonDropdownItem[] {
    return [
      {id: WalkLeadEditAction.LEAD, label: this.caption(), icon: this.faPersonWalking},
      {id: WalkLeadEditAction.EDIT, label: this.editCaption, icon: this.faPencil}
    ];
  }

  protected onLeadEdit(action: string): void {
    if (action === WalkLeadEditAction.EDIT) {
      this.display.edit(this.displayedWalk, {bypassLeaderInit: true});
    } else {
      this.display.edit(this.displayedWalk);
    }
  }
}
