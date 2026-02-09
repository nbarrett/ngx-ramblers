import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ButtonWrapper } from "./button-wrapper";
import { BrevoDropdownItem } from "../../../models/brevo-dropdown.model";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-brevo-button",
    styles: [`
    .image
      width: 17px
    .brevo-dropdown
      display: inline-block
      position: relative
    .brevo-dropdown-menu
      left: 0
      right: auto
    :host ::ng-deep .brevo-dropdown .btn::after
      content: ""
      margin-left: 8px
      border-top: 5px solid currentColor
      border-left: 4px solid transparent
      border-right: 4px solid transparent
      display: inline-block
      vertical-align: middle
  `],
    template: `
    <div class="brevo-dropdown" [ngClass]="{'d-inline-block': dropdownItems?.length}" dropdown [isDisabled]="disabled || loading">
      @if (dropdownItems?.length) {
        <div dropdownToggle>
          <app-button-wrapper [disabled]="disabled" [loading]="loading" [button]="button" [showTooltip]="showTooltip" [title]="title">
            <img title class="image"
                 src="/assets/images/local/brevo.ico"
                 alt="{{title}}"/>
          </app-button-wrapper>
        </div>
        <ul *dropdownMenu class="dropdown-menu brevo-dropdown-menu" role="menu">
          @for (item of dropdownItems; track item.id) {
            <li role="menuitem">
              <a class="dropdown-item" [class.disabled]="item.disabled" (click)="selectDropdownItem(item)">
                {{ item.label }}
              </a>
            </li>
          }
        </ul>
      } @else {
        <app-button-wrapper [disabled]="disabled" [loading]="loading" [button]="button" [showTooltip]="showTooltip" [title]="title">
          <img title class="image"
               src="/assets/images/local/brevo.ico"
               alt="{{title}}"/>
        </app-button-wrapper>
      }
    </div>`,
    imports: [ButtonWrapper, BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, NgClass]
})

export class BrevoButtonComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("BrevoButtonComponent", NgxLoggerLevel.ERROR);
  public disabled: boolean;
  public button: boolean;
  public loading: boolean;
  public showTooltip: boolean;
  public title: string;
  public dropdownItems: BrevoDropdownItem[] = [];

  @Input("title") set titleValue(value: string) {
    this.title = value;
  }

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Input("loading") set loadingValue(value: boolean) {
    this.loading = coerceBooleanProperty(value);
  }

  @Input("button") set buttonValue(value: boolean) {
    this.button = coerceBooleanProperty(value);
  }

  @Input("showTooltip") set showTooltipValue(value: boolean) {
    this.showTooltip = coerceBooleanProperty(value);
  }

  @Input("dropdownItems") set dropdownItemsValue(value: BrevoDropdownItem[]) {
    this.dropdownItems = value || [];
  }

  @Output() dropdownSelected: EventEmitter<BrevoDropdownItem> = new EventEmitter();

  selectDropdownItem(item: BrevoDropdownItem) {
    if (item?.disabled) {
      return;
    }
    this.dropdownSelected.emit(item);
  }

  ngOnInit(): void {
    this.logger.info("initialised with title:", this.title, "disabled:", this.disabled, "showTooltip:", this.showTooltip, "button:", this.button);
  }
}
