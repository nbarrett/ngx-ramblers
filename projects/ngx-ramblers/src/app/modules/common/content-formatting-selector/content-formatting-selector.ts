import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ContentTextStyles, ListStyle } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { BsDropdownModule } from "ngx-bootstrap/dropdown";
import { NgTemplateOutlet } from "@angular/common";

@Component({
  selector: "app-content-formatting-selector",
    imports: [BsDropdownModule, NgTemplateOutlet],
  template: `
    @if (standaloneMenu) {
      <ul *dropdownMenu class="dropdown-menu" (click)="$event.stopPropagation()">
        <ng-container [ngTemplateOutlet]="items"></ng-container>
      </ul>
    } @else {
      <ng-container [ngTemplateOutlet]="items"></ng-container>
    }

    <ng-template #items>
      <li class="dropdown-header">Bullet style</li>
      <li>
        <a class="dropdown-item" (click)="selectListStyle(ListStyle.ARROW)">
          <div class="list-style-arrow">
            <small class="p-2" [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.ARROW)}">{{ listStyleIs(ListStyle.ARROW) ? 'Selected' : '' }}</small>
          </div>
        </a>
      </li>
      <li>
        <a class="dropdown-item" (click)="selectListStyle(ListStyle.TICK_MEDIUM)">
          <div class="list-style-tick-medium">
            <small class="p-2" [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.TICK_MEDIUM)}">{{ listStyleIs(ListStyle.TICK_MEDIUM) ? 'Selected' : '' }}</small>
          </div>
        </a>
      </li>
      <li>
        <a class="dropdown-item" (click)="selectListStyle(ListStyle.TICK_LARGE)">
          <div class="list-style-tick-large">
            <small class="p-2" [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.TICK_LARGE)}">{{ listStyleIs(ListStyle.TICK_LARGE) ? 'Selected' : '' }}</small>
          </div>
        </a>
      </li>
      <li>
        <a class="dropdown-item" (click)="selectListStyle(ListStyle.NO_IMAGE)">
          <div class="list-style-none"><small>(no image)</small>
            <small class="p-2" [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.NO_IMAGE)}">{{ listStyleIs(ListStyle.NO_IMAGE) ? 'Selected' : '' }}</small>
          </div>
        </a>
      </li>
      <li><hr class="dropdown-divider"></li>
      <li class="dropdown-header">Styling Options</li>
      <li>
        <a class="dropdown-item p-1" (click)="selectTextStyle('as-button')">
          <span class="badge-as-button btn-sm w-100 d-inline-block text-center">Make Links Buttons</span>
          @if (textStyleIs('as-button')) {
            <strong> (Selected)</strong>
          }
        </a>
      </li>
      <li><a class="dropdown-item" (click)="selectTextStyle('')">
        Clear
        @if (textStyleIs('')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item" (click)="selectTextStyle('d-none')">
        Hide
        @if (textStyleIs('d-none')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" (click)="selectTextStyle('text-style-cloudy')">
        <span class="text-style-cloudy d-block text-center px-2 py-0 rounded">Cloudy</span>
        @if (textStyleIs('text-style-cloudy')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" (click)="selectTextStyle('text-style-granite')">
        <span class="text-style-granite d-block text-center px-2 py-0 rounded">Granite</span>
        @if (textStyleIs('text-style-granite')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" (click)="selectTextStyle('text-style-mintcake')">
        <span class="text-style-mintcake d-block text-center px-2 py-0 rounded">Mintcake</span>
        @if (textStyleIs('text-style-mintcake')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" (click)="selectTextStyle('text-style-rosycheeks')">
        <span class="text-style-rosycheeks d-block text-center px-2 py-0 rounded">Rosy Cheeks</span>
        @if (textStyleIs('text-style-rosycheeks')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" (click)="selectTextStyle('text-style-sunrise')">
        <span class="text-style-sunrise d-block text-center px-2 py-0 rounded">Sunrise</span>
        @if (textStyleIs('text-style-sunrise')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" (click)="selectTextStyle('text-style-sunset')">
        <span class="text-style-sunset d-block text-center px-2 py-0 rounded">Sunset</span>
        @if (textStyleIs('text-style-sunset')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" (click)="selectTextStyle('text-style-grey')">
        <span class="text-style-grey d-block text-center px-2 py-0 rounded">Grey</span>
        @if (textStyleIs('text-style-grey')) {
          <strong> (Selected)</strong>
        }
      </a></li>
    </ng-template>
  `
})
export class ContentFormattingSelectorComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("ContentFormattingSelectorComponent", NgxLoggerLevel.ERROR);
  protected readonly ListStyle = ListStyle;

  @Input() styles: ContentTextStyles;
  @Input() standaloneMenu = true;
  @Output() listStyleChange = new EventEmitter<ListStyle>();
  @Output() textStyleChange = new EventEmitter<string>();

  selectListStyle(listStyle: ListStyle) {
    this.logger.debug("selectListStyle:", listStyle);
    this.listStyleChange.emit(listStyle);
  }

  selectTextStyle(className: string) {
    this.logger.debug("selectTextStyle:", className);
    this.textStyleChange.emit(className);
  }

  listStyleIs(listStyle: ListStyle): boolean {
    return this.styles?.list === listStyle || (!this.styles?.list && listStyle === ListStyle.ARROW);
  }

  textStyleIs(className: string): boolean {
    return this.styles?.class === className || (!this.styles?.class && className === "");
  }
}
