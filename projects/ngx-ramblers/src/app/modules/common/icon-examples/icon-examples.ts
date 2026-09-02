import { afterNextRender, Component, ElementRef, EventEmitter, inject, Injector, Input, OnInit, Output, ViewChild } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { range } from "es-toolkit";
import { NgxLoggerLevel } from "ngx-logger";
import { iconColourAsHex, iconColourChoices, resolvedIconColour } from "../../../functions/icon-colour";
import { ICON_COLOURS, IconColourMenu, IconColourMenuItem } from "../../../models/content-text.model";
import { KeyValue } from "../../../functions/enums";
import { IconService } from "../../../services/icon-service/icon-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgTemplateOutlet } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { DraggableModalComponent } from "../draggable-modal/draggable-modal";
import { ColourSwatchSelectorComponent } from "../../../shared/components/colour-swatch-selector";

@Component({
    selector: "app-icon-examples",
    templateUrl: "./icon-examples.html",
    styleUrls: ["./icon-examples.sass"],
    imports: [FormsModule, FontAwesomeModule, NgTemplateOutlet, DraggableModalComponent, ColourSwatchSelectorComponent]
})

export class IconExamplesComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("IconExamplesComponent", NgxLoggerLevel.ERROR);
  iconService = inject(IconService);
  public filteredIcons: KeyValue<any>[] = [];
  displayedIcons: KeyValue<any>[] = [];
  filter: string;
  sizes = range(1, 6).map(size => `fa-${size}x`);
  size = "fa-3x";
  compactMode = false;
  pickerOpen = false;
  colourPaletteOpen = false;
  IconColourMenu = IconColourMenu;
  itemHeight = 40;
  viewportHeight = 320;
  windowTop = 0;
  listSize = 0;
  scrollState = {start: 0};
  gridColumns = 8;
  gridRowHeight = 88;
  maxGridWindowRows = 8;
  gridFilter = "";
  gridIcons: KeyValue<any>[] = [];
  displayedGridIcons: KeyValue<any>[] = [];
  gridWindowTop = 0;
  gridListSize = 0;
  gridScroll = {start: 0};
  @ViewChild("iconList") iconList: ElementRef<HTMLElement>;
  @ViewChild("gridList") gridList: ElementRef<HTMLElement>;
  @ViewChild("iconSearch") iconSearch: ElementRef<HTMLInputElement>;
  private injector = inject(Injector);

  @Input() value: string;
  @Input() inputId: string;
  @Output() valueChange = new EventEmitter<string>();
  @Output() iconColourChange = new EventEmitter<string | null>();
  pickerColours = iconColourChoices();
  colourMenu: IconColourMenuItem[] = [];
  selectedColourMenuValue: string = IconColourMenu.DEFAULT;
  private colourValue: string | null = null;
  private namedColourMenu: IconColourMenuItem[] = ICON_COLOURS.map(item => ({
    label: item.name,
    value: item.cssClass ? iconColourAsHex(item.swatch) : IconColourMenu.DEFAULT,
    swatch: iconColourAsHex(item.swatch)
  }));

  @Input()
  set iconColour(value: string | null) {
    if (value !== this.colourValue) {
      this.colourValue = value;
      this.refreshColourMenu();
    }
  }

  get iconColour(): string | null {
    return this.colourValue;
  }

  @Input("compact") set compactValue(value: boolean) {
    this.compactMode = coerceBooleanProperty(value);
  }

  ngOnInit() {
    this.filter = this.value || "";
    this.refreshColourMenu();
    if (!this.compactMode) {
      this.refreshFilter(this.filter);
    }
  }

  modelChanged(data: string) {
    this.logger.debug("filter changed:", data);
    this.filter = data;
    if (this.pickerOpen || !this.compactMode) {
      this.refreshFilter(data);
    } else {
      const exactKey = this.exactIconKey(data);
      if (exactKey && exactKey !== this.value) {
        this.value = exactKey;
        this.valueChange.emit(exactKey);
      }
    }
  }

  onIconNameEnter(event: Event) {
    event.preventDefault();
    const exactKey = this.exactIconKey(this.filter);
    if (exactKey) {
      this.selectIcon(exactKey);
    } else {
      this.openPicker();
    }
  }

  refreshFilter(data: string) {
    this.filteredIcons = this.iconService.matchingIcons(data);
    this.scrollState.start = 0;
    if (this.iconList?.nativeElement) {
      this.iconList.nativeElement.scrollTop = 0;
    }
    this.updateVisibleWindow();
    const exactKey = this.exactIconKey(data);
    if (exactKey && exactKey !== this.value) {
      this.value = exactKey;
      this.valueChange.emit(exactKey);
    }
  }

  exactIconKey(query: string): string | null {
    return this.iconService.matchedKey(query);
  }

  onListScroll(event: Event) {
    const scrollTop = (event.target as HTMLElement).scrollTop;
    this.scrollState.start = Math.floor(scrollTop / this.itemHeight);
    this.updateVisibleWindow();
  }

  updateVisibleWindow() {
    const buffer = 8;
    const start = Math.max(0, this.scrollState.start - buffer);
    const visibleCount = Math.ceil(this.viewportHeight / this.itemHeight) + buffer * 2;
    this.displayedIcons = this.filteredIcons.slice(start, start + visibleCount);
    this.windowTop = start * this.itemHeight;
    this.listSize = this.filteredIcons.length * this.itemHeight;
  }

  selectedIcon() {
    return this.iconService.iconForName(this.value);
  }

  changeIconLabel(): string {
    if (this.value) {
      return "Change icon";
    } else {
      return "Choose icon";
    }
  }

  colourStyle(): string {
    return resolvedIconColour(this.iconColour);
  }

  colourHex(): string {
    return iconColourAsHex(this.iconColour);
  }

  selectColourValue(colour: string) {
    const hex = iconColourAsHex(colour);
    this.colourValue = hex;
    this.refreshColourMenu();
    this.iconColourChange.emit(hex);
  }

  refreshColourMenu() {
    const current = this.colourHex();
    const needsCustom = !this.namedColourMenu.some(item => item.value === current);
    const hasCustom = this.colourMenu.some(item => item.label === "Custom");
    if (this.colourMenu.length === 0 || needsCustom !== hasCustom) {
      const custom = needsCustom ? [{label: "Custom", value: current, swatch: current}] : [];
      this.colourMenu = [...this.namedColourMenu, ...custom, {label: "Palette", value: IconColourMenu.PALETTE, swatch: current}];
    } else if (needsCustom) {
      this.colourMenu = this.colourMenu.map(item => item.label === "Custom" ? {label: "Custom", value: current, swatch: current} : item);
    }
    if (this.colourPaletteOpen) {
      this.selectedColourMenuValue = IconColourMenu.PALETTE;
    } else if (!this.colourValue) {
      this.selectedColourMenuValue = IconColourMenu.DEFAULT;
    } else {
      this.selectedColourMenuValue = current;
    }
  }

  onColourMenuChange(value: string) {
    if (value === IconColourMenu.PALETTE) {
      this.colourPaletteOpen = true;
      this.refreshColourMenu();
    } else if (value === IconColourMenu.DEFAULT) {
      this.colourValue = null;
      this.refreshColourMenu();
      this.iconColourChange.emit(null);
    } else if (value !== this.colourHex()) {
      this.selectColourValue(value);
    }
  }

  onCustomColourPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectColourValue(input.value);
  }

  closeColourPalette() {
    this.colourPaletteOpen = false;
    this.refreshColourMenu();
  }

  selectColourFromPalette(colour: string) {
    this.selectColourValue(colour);
    this.closeColourPalette();
  }

  isSelected(key: string): boolean {
    return (this.value || "").toLowerCase() === (key || "").toLowerCase();
  }

  openPicker() {
    this.pickerOpen = true;
    if (this.filter && this.filter !== (this.value || "")) {
      this.gridFilter = this.filter;
    } else {
      this.gridFilter = this.value || this.filter || "";
    }
    this.refreshGrid(this.gridFilter);
    afterNextRender(() => {
      const input = this.iconSearch?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, {injector: this.injector});
  }

  closePicker() {
    this.pickerOpen = false;
    this.displayedGridIcons = [];
    this.gridIcons = [];
  }

  gridSearchChanged(data: string) {
    this.gridFilter = data;
    this.refreshGrid(data);
  }

  iconMatchCount(): number {
    return this.gridIcons.length;
  }

  refreshGrid(data: string) {
    this.gridIcons = this.iconService.matchingIcons(data);
    this.gridScroll.start = 0;
    if (this.gridList?.nativeElement) {
      this.gridList.nativeElement.scrollTop = 0;
    }
    this.updateVisibleGrid();
  }

  onGridScroll(event: Event) {
    const scrollTop = (event.target as HTMLElement).scrollTop;
    this.gridScroll.start = Math.floor(scrollTop / this.gridRowHeight);
    this.updateVisibleGrid();
  }

  updateVisibleGrid() {
    const startRow = Math.max(0, this.gridScroll.start);
    const start = startRow * this.gridColumns;
    const count = this.maxGridWindowRows * this.gridColumns;
    this.displayedGridIcons = this.gridIcons.slice(start, start + count);
    this.gridWindowTop = startRow * this.gridRowHeight;
    this.gridListSize = Math.ceil(this.gridIcons.length / this.gridColumns) * this.gridRowHeight;
  }

  scrollGridToKey(key: string) {
    const index = this.gridIcons.findIndex(item => (item.key || "").toLowerCase() === (key || "").toLowerCase());
    if (index >= 0) {
      const row = Math.floor(index / this.gridColumns);
      this.gridScroll.start = row;
      if (this.gridList?.nativeElement) {
        this.gridList.nativeElement.scrollTop = row * this.gridRowHeight;
      }
      this.updateVisibleGrid();
    }
  }

  selectIcon(key: string) {
    if (key) {
      this.value = key;
      this.filter = key;
      this.refreshFilter(key);
      this.closePicker();
      this.valueChange.emit(key);
      if (!this.compactMode) {
        this.scrollToKey(key);
      }
    }
  }

  scrollToKey(key: string) {
    const index = this.filteredIcons.findIndex(item => (item.key || "").toLowerCase() === (key || "").toLowerCase());
    if (index >= 0) {
      this.scrollState.start = index;
      if (this.iconList?.nativeElement) {
        this.iconList.nativeElement.scrollTop = index * this.itemHeight;
      }
      this.updateVisibleWindow();
    }
  }

}
