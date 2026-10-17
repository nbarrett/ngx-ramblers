import { Component, Input, output } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import { RouterLink } from "@angular/router";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import {
  ButtonDropdownContainer,
  ButtonDropdownItem,
  ButtonDropdownItemType,
  ButtonDropdownPlacement
} from "../../../models/button-dropdown.model";
import { TOOLTIP_SHOW_DELAY_MS } from "../tooltip-config";

@Component({
  selector: "app-button-dropdown",
  imports: [BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, FontAwesomeModule, TooltipDirective, RouterLink, NgClass, NgTemplateOutlet],
  host: {
    "[class.full-width]": "fullWidth",
    "[class.compact]": "compact"
  },
  styles: [`
    :host
      display: flex
      min-width: 0
      position: relative

    :host:has(.btn-group.show)
      z-index: 1100

    :host.full-width
      width: 100%

    :host.compact
      display: inline-flex
      width: auto

    :host.compact .btn-group
      flex: 0 0 auto
      width: auto

    :host.compact .btn-group > .btn
      min-height: var(--btn-min-height)
      height: var(--btn-min-height)
      padding-top: 0
      padding-bottom: 0
      padding-left: 0.5rem
      padding-right: 0.5rem
      gap: var(--space-2)
      justify-content: flex-start
    :host.compact .btn-group > .dropdown-toggle-split
      flex: 0 0 var(--button-dropdown-caret-width, 1.75rem)
      width: var(--button-dropdown-caret-width, 1.75rem)
      min-width: var(--button-dropdown-caret-width, 1.75rem)
      padding-left: 0
      padding-right: 0
      justify-content: center

    .btn-group
      display: flex
      flex: 1 1 auto
      width: 100%
      min-width: 0

    .btn-group > .dropdown-toggle:not(.dropdown-toggle-split)
      display: inline-flex
      flex: 1 1 auto
      align-items: center
      justify-content: center
      gap: var(--space-3)
      width: 100%
      min-height: var(--btn-min-height)
      height: 100%

    .btn-group > .btn:not(.dropdown-toggle)
      display: inline-flex
      flex: 1 1 auto
      align-items: center
      justify-content: center
      gap: var(--space-3)
      min-height: var(--btn-min-height)
      height: 100%

    .btn-group > .dropdown-toggle-split
      flex: 0 0 auto
      width: auto
      min-height: var(--btn-min-height)

    .btn-group:hover > .btn:not(:disabled),
    .btn-group.show > .btn:not(:disabled),
    .btn-group:focus-within > .btn:not(:disabled)
      color: #000
      background-color: var(--rsm-btn-ghost-hover-bg)
      border-color: var(--rsm-btn-ghost-hover-border)

    .btn-group > .dropdown-toggle fa-icon
      display: inline-flex
      align-items: center
      justify-content: center
      flex: 0 0 1.15em
      width: 1.15em
      line-height: 1

    .btn-group > .btn:not(.dropdown-toggle) fa-icon
      display: inline-flex
      align-items: center
      justify-content: center
      flex: 0 0 1.15em
      width: 1.15em
      line-height: 1

    .btn-group > .dropdown-toggle::after
      margin-left: 0
      vertical-align: middle

    .btn-group > .dropdown-menu
      min-width: 100%
      width: max-content
      background-color: var(--bs-dropdown-bg, #fff)
      z-index: 1100

    .dropdown-item
      display: flex
      align-items: center
      gap: var(--space-3)
      white-space: nowrap

    .dropdown-item fa-icon
      display: inline-flex
      align-items: center
      justify-content: center
      flex: 0 0 1.15em
      width: 1.15em
      line-height: 1

    .dropdown-item-copy
      display: flex
      flex-direction: column
      align-items: flex-start
      justify-content: center
      min-width: max-content
      flex: 1 1 auto
      line-height: 1.25
      text-align: left

    .dropdown-item-extra
      margin-top: 0.15em
      font-size: 0.8125rem
      font-weight: 400
      color: var(--bs-secondary-color, #6c757d)

    .dropdown-item-selected
      margin-left: auto
  `],
  template: `
    <div class="btn-group" [class.w-100]="fullWidth" [ngClass]="groupClass"
         dropdown
         [dropup]="dropUp"
         [container]="container"
         [placement]="placement"
         [insideClick]="insideClick"
         [isDisabled]="disabled">
      @if (disabled) {
        <button type="button"
                class="{{ buttonClass }}"
                [class.w-100]="fullWidth"
                disabled
                [tooltip]="tooltip"
                [container]="tooltipContainer || 'body'"
                [delay]="tooltipDelay ?? TOOLTIP_SHOW_DELAY_MS"
                [adaptivePosition]="false"
                [placement]="tooltipPlacement"
                [attr.aria-label]="ariaLabel || tooltip || label">
          @if (icon) {
            <fa-icon [icon]="icon" [animation]="iconSpin ? 'spin' : undefined"/>
          }
          @if (label) {
            <span>{{ label }}</span>
          }
        </button>
      } @else if (hasDefaultAction()) {
        <button type="button"
                class="{{ buttonClass }}"
                [tooltip]="tooltip"
                [container]="tooltipContainer || 'body'"
                [delay]="tooltipDelay ?? TOOLTIP_SHOW_DELAY_MS"
                [adaptivePosition]="false"
                [placement]="tooltipPlacement"
                [attr.aria-label]="ariaLabel || tooltip || label"
                (click)="onFaceClick($event)">
          @if (icon) {
            <fa-icon [icon]="icon" [animation]="iconSpin ? 'spin' : undefined"/>
          }
          @if (label) {
            <span>{{ label }}</span>
          }
        </button>
        <button type="button"
                class="dropdown-toggle dropdown-toggle-split {{ buttonClass }}"
                dropdownToggle
                [attr.aria-label]="'More ' + (label || 'options')">
        </button>
      } @else {
        <button type="button"
                class="dropdown-toggle {{ buttonClass }}"
                [class.w-100]="fullWidth"
                dropdownToggle
                [tooltip]="tooltip"
                [container]="tooltipContainer || 'body'"
                [delay]="tooltipDelay ?? TOOLTIP_SHOW_DELAY_MS"
                [adaptivePosition]="false"
                [placement]="tooltipPlacement"
                [attr.aria-label]="ariaLabel || label">
          @if (icon) {
            <fa-icon [icon]="icon" [animation]="iconSpin ? 'spin' : undefined"/>
          }
          @if (label) {
            <span>{{ label }}</span>
          }
        </button>
      }
      @if (!disabled) {
      <ul *dropdownMenu class="dropdown-menu" [class.dropdown-menu-end]="menuEnd"
          [ngClass]="menuClass" role="menu">
        @for (item of items; track item.id) {
          @if (!item.hidden) {
            @switch (item.type) {
              @case (ButtonDropdownItemType.DIVIDER) {
                <li class="dropdown-divider"></li>
              }
              @case (ButtonDropdownItemType.HEADER) {
                <li class="dropdown-header">{{ item.label }}</li>
              }
              @default {
                <li role="menuitem">
                  @if (item.routerLink) {
                    <a class="dropdown-item" [class.text-danger]="item.danger"
                       [class.disabled]="item.disabled" [ngClass]="item.itemClass"
                       [routerLink]="item.routerLink" [queryParams]="item.queryParams"
                       [tooltip]="item.tooltip" [placement]="item.tooltipPlacement || 'left'" container="body">
                      <ng-container *ngTemplateOutlet="itemBody; context: {$implicit: item}"/>
                    </a>
                  } @else if (item.href) {
                    <a class="dropdown-item" [class.text-danger]="item.danger"
                       [class.disabled]="item.disabled" [ngClass]="item.itemClass"
                       [href]="item.href" [target]="item.target || '_self'" [attr.rel]="item.rel"
                       [tooltip]="item.tooltip" [placement]="item.tooltipPlacement || 'left'" container="body">
                      <ng-container *ngTemplateOutlet="itemBody; context: {$implicit: item}"/>
                    </a>
                  } @else {
                    <button type="button" class="dropdown-item"
                            [class.text-danger]="item.danger"
                            [ngClass]="item.itemClass" [disabled]="item.disabled"
                            [tooltip]="item.tooltip" [placement]="item.tooltipPlacement || 'left'" container="body"
                            (click)="choose(item)">
                      <ng-container *ngTemplateOutlet="itemBody; context: {$implicit: item}"/>
                    </button>
                  }
                </li>
              }
            }
          }
        }
      </ul>
      }
    </div>
    <ng-template #itemBody let-item>
      @if (item.icon) {
        <fa-icon [icon]="item.icon"/>
      }
      <span class="dropdown-item-copy">
        <span>{{ item.label }}</span>
        @if (item.extraLabel) {
          <span class="dropdown-item-extra">{{ item.extraLabel }}</span>
        }
      </span>
      @if (item.selected) {
        <fa-icon [icon]="faCheck" class="dropdown-item-selected"/>
      }
    </ng-template>
  `
})
export class ButtonDropdownComponent {
  @Input() label: string = null;
  @Input() icon: IconDefinition = null;
  @Input() items: ButtonDropdownItem[] = [];
  @Input() buttonClass = "btn btn-quiet";
  @Input() groupClass: string = null;
  @Input() menuClass: string = null;
  @Input() tooltip: string = null;
  @Input() tooltipContainer: string = null;
  @Input() tooltipDelay: number = null;
  @Input() tooltipPlacement = "top";
  @Input() ariaLabel: string = null;
  @Input() container: ButtonDropdownContainer | string = null;
  @Input() placement: ButtonDropdownPlacement | string = null;
  @Input() defaultItemId: string = null;
  readonly itemSelect = output<string>();
  protected disabled = false;
  protected dropUp = false;
  protected fullWidth = false;
  protected compact = false;
  protected insideClick = false;
  protected menuEnd = false;
  protected iconSpin = false;
  protected readonly ButtonDropdownItemType = ButtonDropdownItemType;
  protected readonly faCheck = faCheck;

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Input("dropup") set dropupValue(value: boolean) {
    this.dropUp = coerceBooleanProperty(value);
  }

  @Input("fullWidth") set fullWidthValue(value: boolean) {
    this.fullWidth = coerceBooleanProperty(value);
  }

  @Input("compact") set compactValue(value: boolean) {
    this.compact = coerceBooleanProperty(value);
  }

  @Input("insideClick") set insideClickValue(value: boolean) {
    this.insideClick = coerceBooleanProperty(value);
  }

  @Input("menuEnd") set menuEndValue(value: boolean) {
    this.menuEnd = coerceBooleanProperty(value);
  }

  @Input("iconSpin") set iconSpinValue(value: boolean) {
    this.iconSpin = coerceBooleanProperty(value);
  }

  protected choose(item: ButtonDropdownItem): void {
    if (!item.disabled && !this.disabled) {
      this.itemSelect.emit(item.id);
    }
  }

  protected hasDefaultAction(): boolean {
    return !!this.resolvedDefaultItem();
  }

  protected onFaceClick(event: Event): void {
    this.chooseDefault();
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.blur();
    }
  }

  protected chooseDefault(): void {
    const item = this.resolvedDefaultItem();
    if (item) {
      this.choose(item);
    }
  }

  private resolvedDefaultItem(): ButtonDropdownItem {
    if (this.defaultItemId) {
      return (this.items ?? []).find(candidate => candidate.id === this.defaultItemId) ?? null;
    } else {
      return null;
    }
  }

  protected readonly TOOLTIP_SHOW_DELAY_MS = TOOLTIP_SHOW_DELAY_MS;
}
