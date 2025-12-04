import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MapRoute } from "../../../models/content-text.model";
import { isUndefined } from "es-toolkit/compat";

@Component({
  selector: "app-map-route-style-palette",
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host
      display: inline-block

    .style-button
      min-width: 80px
      display: inline-flex
      align-items: center
      gap: 0.4rem

    .style-button.active
      background-color: var(--bs-secondary)
      color: #fff
      border-color: var(--bs-secondary)

    .palette-panel
      position: absolute
      right: 0
      top: calc(100% + 0.5rem)
      width: max-content
      min-width: 320px
      max-width: calc(100vw - 2rem)
      background: #fff
      border-radius: 0.75rem
      padding: 1rem
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15)
      z-index: 1080

    .palette-heading
      font-size: 0.85rem
      font-weight: 600
      margin-bottom: 0.35rem

    .color-options
      display: flex
      gap: 0.4rem
      margin-bottom: 0.75rem
      flex-wrap: nowrap
      justify-content: space-between

    .color-swatch
      width: 28px
      height: 28px
      border-radius: 50%
      border: 2px solid transparent
      padding: 0

    .color-swatch.selected
      border-color: var(--bs-primary)

    .color-dot
      width: 14px
      height: 14px
      border-radius: 50%
      border: 1px solid rgba(0, 0, 0, 0.2)

    .thickness-options
      display: flex
      gap: 0.5rem
      margin-bottom: 0.75rem
      flex-wrap: nowrap

    .thickness-option
      flex: 1
      padding: 0.25rem 0
      border-radius: 0.25rem
      border: 2px solid transparent
      display: flex
      justify-content: center
      align-items: center

    .thickness-option.selected
      border-color: var(--bs-primary)
      background: rgba(19, 132, 227, 0.08)

    .thickness-line
      width: 80%
      border-top: 0 solid #000

    .transparency-row
      display: flex
      align-items: center
      gap: 0.5rem

    .transparency-row span
      width: 42px
      text-align: right
      font-size: 0.85rem

    .editor-slider
      accent-color: var(--ramblers-colour-sunrise)
      width: 100%

    :host ::ng-deep input.editor-slider::-webkit-slider-thumb
      background-color: var(--ramblers-colour-sunrise)
      border: 2px solid var(--ramblers-colour-sunrise)
      box-shadow: none

    :host ::ng-deep input.editor-slider::-moz-range-thumb
      background-color: var(--ramblers-colour-sunrise)
      border: 2px solid var(--ramblers-colour-sunrise)
      box-shadow: none
    `],
  template: `
    <div class="position-relative">
      <button type="button"
              class="btn btn-outline-secondary btn-sm style-button"
              [class.active]="open"
              (click)="toggle($event)">
        <span class="color-dot" [style.backgroundColor]="route?.color || paletteColors[0]"></span>
        Style
      </button>
      @if (open) {
        <div class="palette-panel">
          <div class="palette-heading">Line Colour</div>
          <div class="color-options">
            @for (color of paletteColors; track color) {
              <button type="button"
                      class="color-swatch"
                      [style.backgroundColor]="color"
                      [class.selected]="route?.color === color"
                      (click)="selectColor(color)">
              </button>
            }
          </div>
          <div class="palette-heading">Line Thickness</div>
          <div class="thickness-options">
            @for (line of thicknessOptions; track line) {
              <button type="button"
                      class="thickness-option"
                      [class.selected]="(route?.weight || defaultWeight) === line"
                      (click)="selectThickness(line)">
                <div class="thickness-line" [style.borderTopWidth.px]="line"></div>
              </button>
            }
          </div>
          <div class="palette-heading">Line Transparency</div>
          <div class="transparency-row">
            <input class="form-range editor-slider"
                   type="range"
                   min="0"
                   max="100"
                   [(ngModel)]="transparencyPercent"
                   (ngModelChange)="onTransparencyChange()">
            <span>{{ transparencyPercent }}%</span>
          </div>
        </div>
      }
    </div>
  `
})
export class MapRouteStylePaletteComponent implements OnInit, OnChanges {
  @Input() route: MapRoute;
  @Output() styleChange = new EventEmitter<void>();

  paletteColors: string[] = ["#3f3f3f", "#5a45c6", "#c21d4b", "#4c6c3e", "#bf8630", "#2e54a6"];
  thicknessOptions: number[] = [4, 6, 8, 10];
  defaultWeight = 8;
  defaultOpacity = 1.0;
  open = false;
  transparencyPercent = 0;

  constructor(private elementRef: ElementRef) {
  }

  ngOnInit() {
    this.syncTransparency();
    this.ensureDefaults();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["route"]) {
      this.syncTransparency();
      this.ensureDefaults();
    }
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    this.open = !this.open;
  }

  selectColor(color: string) {
    if (this.route) {
      this.route.color = color;
      this.emitChange();
    }
  }

  selectThickness(value: number) {
    if (this.route) {
      this.route.weight = value;
      this.emitChange();
    }
  }

  onTransparencyChange() {
    if (this.route) {
      this.route.opacity = 1 - (this.transparencyPercent / 100);
      this.emitChange();
    }
  }

  @HostListener("document:click", ["$event"])
  closePalette(event: MouseEvent) {
    if (this.open && !this.elementRef.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }

  private emitChange() {
    this.styleChange.emit();
  }

  private syncTransparency() {
    const opacity = this.route?.opacity ?? this.defaultOpacity;
    this.transparencyPercent = Math.round((1 - opacity) * 100);
  }

  private ensureDefaults() {
    if (!this.route) {
      return;
    }
    if (!this.route.weight) {
      this.route.weight = this.defaultWeight;
    }
    if (isUndefined(this.route.opacity)) {
      this.route.opacity = this.defaultOpacity;
    }
    if (!this.route.color) {
      this.route.color = this.paletteColors[0];
    }
  }
}
