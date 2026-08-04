import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ContentTextStyles, ListStyle } from "../../../models/content-text.model";
import { TextStyle } from "../../../models/system.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { BsDropdownModule } from "ngx-bootstrap/dropdown";
import { NgClass, NgTemplateOutlet } from "@angular/common";

@Component({
  selector: "app-content-formatting-selector",
    imports: [BsDropdownModule, NgClass, NgTemplateOutlet],
  template: `
    @if (standaloneMenu) {
      <ul *dropdownMenu class="dropdown-menu" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
        <ng-container [ngTemplateOutlet]="items"></ng-container>
      </ul>
    } @else {
      <ng-container [ngTemplateOutlet]="items"></ng-container>
    }

    <ng-template #items>
      <li class="dropdown-header">Bullet style</li>
      <li>
        <a class="dropdown-item" href="#" (mousedown)="selectListStyle(ListStyle.ARROW, $event)">
          <div class="list-style-arrow">
            <small class="p-2" [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.ARROW)}">{{ listStyleIs(ListStyle.ARROW) ? 'Selected' : '' }}</small>
          </div>
        </a>
      </li>
      <li>
        <a class="dropdown-item" href="#" (mousedown)="selectListStyle(ListStyle.TICK_MEDIUM, $event)">
          <div class="list-style-tick-medium">
            <small class="p-2" [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.TICK_MEDIUM)}">{{ listStyleIs(ListStyle.TICK_MEDIUM) ? 'Selected' : '' }}</small>
          </div>
        </a>
      </li>
      <li>
        <a class="dropdown-item" href="#" (mousedown)="selectListStyle(ListStyle.TICK_LARGE, $event)">
          <div class="list-style-tick-large">
            <small class="p-2" [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.TICK_LARGE)}">{{ listStyleIs(ListStyle.TICK_LARGE) ? 'Selected' : '' }}</small>
          </div>
        </a>
      </li>
      <li>
        <a class="dropdown-item" href="#" (mousedown)="selectListStyle(ListStyle.NO_IMAGE, $event)">
          <div class="list-style-none"><small>(no image)</small>
            <small class="p-2" [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.NO_IMAGE)}">{{ listStyleIs(ListStyle.NO_IMAGE) ? 'Selected' : '' }}</small>
          </div>
        </a>
      </li>
      <li><hr class="dropdown-divider"></li>
      <li class="dropdown-header">Styling Options</li>
      <li>
        <a class="dropdown-item p-1" href="#" (mousedown)="selectTextStyle(TextStyle.AS_BUTTON, $event)">
          <span class="badge-as-button btn-sm w-100 d-inline-block text-center">Make Links Buttons</span>
          @if (textStyleIs(TextStyle.AS_BUTTON)) {
            <strong> (Selected)</strong>
          }
        </a>
      </li>
      <li><a class="dropdown-item" href="#" (mousedown)="selectTextStyle('', $event)">
        Clear
        @if (textStyleIs('')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item" href="#" (mousedown)="selectTextStyle('d-none', $event)">
        Hide
        @if (textStyleIs('d-none')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" href="#" (mousedown)="selectTextStyle('text-style-cloudy', $event)">
        <span class="text-style-cloudy d-block text-center px-2 py-0 rounded">Cloudy</span>
        @if (textStyleIs('text-style-cloudy')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" href="#" (mousedown)="selectTextStyle('text-style-granite', $event)">
        <span class="text-style-granite d-block text-center px-2 py-0 rounded">Granite</span>
        @if (textStyleIs('text-style-granite')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" href="#" (mousedown)="selectTextStyle('text-style-mintcake', $event)">
        <span class="text-style-mintcake d-block text-center px-2 py-0 rounded">Mintcake</span>
        @if (textStyleIs('text-style-mintcake')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" href="#" (mousedown)="selectTextStyle('text-style-rosycheeks', $event)">
        <span class="text-style-rosycheeks d-block text-center px-2 py-0 rounded">Rosy Cheeks</span>
        @if (textStyleIs('text-style-rosycheeks')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" href="#" (mousedown)="selectTextStyle('text-style-sunrise', $event)">
        <span class="text-style-sunrise d-block text-center px-2 py-0 rounded">Sunrise</span>
        @if (textStyleIs('text-style-sunrise')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" href="#" (mousedown)="selectTextStyle('text-style-sunset', $event)">
        <span class="text-style-sunset d-block text-center px-2 py-0 rounded">Sunset</span>
        @if (textStyleIs('text-style-sunset')) {
          <strong> (Selected)</strong>
        }
      </a></li>
      <li><a class="dropdown-item p-1 text-decoration-none" href="#" (mousedown)="selectTextStyle('text-style-grey', $event)">
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
  protected readonly TextStyle = TextStyle;

  @Input() styles: ContentTextStyles;
  @Input() standaloneMenu = true;
  @Output() listStyleChange = new EventEmitter<ListStyle>();
  @Output() textStyleChange = new EventEmitter<string>();

  selectListStyle(listStyle: ListStyle, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.logger.debug("selectListStyle:", listStyle);
    this.listStyleChange.emit(listStyle);
  }

  selectTextStyle(className: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
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
