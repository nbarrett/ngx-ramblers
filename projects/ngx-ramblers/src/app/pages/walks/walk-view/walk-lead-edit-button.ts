import { Component, HostBinding, inject, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEye, faPencil, faPersonWalking } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayedWalk } from "../../../models/walk.model";
import { WalkLeadEditAction, WalkLeadEditAppearance } from "../../../models/walk-edit-mode.model";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalkDisplayService } from "../walk-display.service";
import { ButtonDropdownComponent } from "../../../modules/common/button-dropdown/button-dropdown";
import { ButtonDropdownItem } from "../../../models/button-dropdown.model";
import { TOOLTIP_SHOW_DELAY_MS } from "../../../modules/common/tooltip-config";

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
      display: flex
      min-width: 0
    :host.action > *
      flex: 1 1 auto
      width: 100%
      min-width: 0
    :host.inline
      display: inline-flex
      width: 6.5rem
      --button-dropdown-caret-width: 1.75rem
    :host.inline > *
      width: 100%
      height: 32px
    :host.inline > button.btn
      box-sizing: border-box
      min-height: 32px
      height: 32px
      padding: 0 var(--button-dropdown-caret-width) 0 0.5rem
      display: inline-flex
      align-items: center
      justify-content: flex-start
      gap: var(--space-2)
  `],
  template: `
    @if (displayedWalk?.walkAccessMode?.walkWritable) {
      @if (eventActions() || display.walkAdminLeadAndEdit(displayedWalk)) {
        <app-button-dropdown [class.walk-view-split]="appearance === WalkLeadEditAppearance.ACTION"
                             [fullWidth]="appearance !== WalkLeadEditAppearance.OVERLAY"
                             [compact]="appearance === WalkLeadEditAppearance.INLINE"
                             [label]="caption()"
                             [icon]="eventActions() ? faPencil : faPersonWalking"
                             [buttonClass]="primaryButtonClass()"
                             [ariaLabel]="actionTooltip()"
                             [defaultItemId]="eventActions() ? WalkLeadEditAction.EDIT : WalkLeadEditAction.LEAD"
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
                container="body"
                [delay]="tooltipShowDelay"
                [adaptivePosition]="false"
                placement="top">
          <fa-icon [icon]="actionIcon()"/>
          <span class="ms-2">{{ caption() }}</span>
        </button>
      }
    }
  `
})
export class WalkLeadEditButton {
  public display = inject(WalkDisplayService);
  protected readonly faPencil = faPencil;
  protected readonly faEye = faEye;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly WalkLeadEditAppearance = WalkLeadEditAppearance;
  protected readonly WalkLeadEditAction = WalkLeadEditAction;
  protected readonly tooltipShowDelay = TOOLTIP_SHOW_DELAY_MS;
  protected readonly editCaption = WalksReferenceService.walkAccessModes.edit.caption;
  @Input() displayedWalk: DisplayedWalk;
  @Input() appearance: WalkLeadEditAppearance = WalkLeadEditAppearance.INLINE;

  @HostBinding("class.overlay")
  get overlayHost(): boolean {
    return this.appearance === WalkLeadEditAppearance.OVERLAY;
  }

  @HostBinding("class.action")
  get actionHost(): boolean {
    return this.appearance === WalkLeadEditAppearance.ACTION;
  }

  @HostBinding("class.walk-view-split")
  get actionSplitHost(): boolean {
    return this.appearance === WalkLeadEditAppearance.ACTION;
  }

  @HostBinding("class.inline")
  get inlineHost(): boolean {
    return this.appearance === WalkLeadEditAppearance.INLINE;
  }

  caption(): string {
    return this.displayedWalk?.walkAccessMode?.caption ?? "";
  }

  actionTooltip(): string {
    const eventType = this.display.isWalk(this.displayedWalk?.walk) ? "walk" : "event";
    return `${this.caption()} this ${eventType}`;
  }

  actionIcon() {
    return this.caption() === WalksReferenceService.walkAccessModes.lead.caption ? this.faPersonWalking : this.faPencil;
  }

  primaryButtonClass(): string {
    if (this.appearance === WalkLeadEditAppearance.ACTION) {
      return "btn btn-primary btn-sm walk-view-action";
    } else if (this.appearance === WalkLeadEditAppearance.INLINE) {
      return "btn pager-btn btn-sm me-0";
    } else {
      return "btn pager-btn me-0";
    }
  }

  protected eventActions(): boolean {
    return !this.display.isWalk(this.displayedWalk?.walk);
  }

  protected leadEditItems(): ButtonDropdownItem[] {
    return this.eventActions() ? [
      {id: WalkLeadEditAction.EDIT, label: this.editCaption, icon: this.faPencil},
      {id: WalkLeadEditAction.VIEW, label: "view", icon: this.faEye}
    ] : [
      {id: WalkLeadEditAction.LEAD, label: this.caption(), icon: this.faPersonWalking},
      {id: WalkLeadEditAction.EDIT, label: this.editCaption, icon: this.faPencil}
    ];
  }

  protected onLeadEdit(action: string): void {
    if (action === WalkLeadEditAction.VIEW) {
      void this.display.openGroupEventView(this.displayedWalk.walk);
    } else if (action === WalkLeadEditAction.EDIT) {
      this.display.edit(this.displayedWalk, {bypassLeaderInit: true});
    } else {
      this.display.edit(this.displayedWalk);
    }
  }
}
