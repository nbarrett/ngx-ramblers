import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";

import { FormsModule } from "@angular/forms";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { MapRoute, PaletteColor } from "../../../models/content-text.model";
import { isUndefined } from "es-toolkit/compat";
import { enumValues } from "../../../functions/enums";
import { ColourSwatchSelectorComponent } from "../../../shared/components/colour-swatch-selector";

@Component({
  selector: "app-map-route-style-palette",
  imports: [FormsModule, ColourSwatchSelectorComponent],
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

    .palette-panel.is-fixed
      position: fixed
      top: auto
      right: auto
      z-index: 2000

    .palette-panel .btn-close
      font-size: 0.75rem
      opacity: 0.5
      transition: opacity 0.15s ease-in-out

    .palette-panel .btn-close:hover
      opacity: 1

    .palette-heading
      font-size: 0.85rem
      font-weight: 600
      margin-bottom: 0.35rem

    app-colour-swatch-selector
      display: block
      margin-bottom: 0.75rem

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
        <div class="palette-panel" [class.is-fixed]="fixedPanel"
             [style.top]="panelTop" [style.bottom]="panelBottom"
             [style.left]="panelLeft" [style.right]="panelRight">
          <button type="button"
                  class="btn-close position-absolute top-0 end-0 m-2"
                  (click)="closePanel()"
                  aria-label="Close style palette">
          </button>
          <div class="palette-heading">Line Colour</div>
          <app-colour-swatch-selector
            [value]="route?.color || paletteColors[0]"
            [colours]="paletteColors"
            (valueChange)="selectColor($event)">
          </app-colour-swatch-selector>
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
  @Input() set fixed(value: boolean) {
    this.fixedPanel = coerceBooleanProperty(value);
  }
  @Output() styleChange = new EventEmitter<void>();

  paletteColors: string[] = enumValues(PaletteColor);
  thicknessOptions: number[] = [4, 6, 8, 10];
  defaultWeight = 8;
  defaultOpacity = 1.0;
  open = false;
  transparencyPercent = 0;
  fixedPanel = false;
  panelTop: string | null = null;
  panelBottom: string | null = null;
  panelLeft: string | null = null;
  panelRight: string | null = null;

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
    if (this.open) {
      this.placePanel();
    }
  }

  closePanel() {
    this.open = false;
  }

  @HostListener("window:resize")
  @HostListener("window:scroll")
  onViewportChange() {
    if (this.open) {
      this.placePanel();
    }
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

  private placePanel() {
    const button = this.elementRef.nativeElement.querySelector(".style-button") as HTMLElement | null;
    if (!this.fixedPanel || !button) {
      this.panelTop = null;
      this.panelBottom = null;
      this.panelLeft = null;
      this.panelRight = null;
    } else {
      const rect = button.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 16);
      const estimatedHeight = 300;
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
      if (rect.top >= estimatedHeight + 8) {
        this.panelTop = null;
        this.panelBottom = `${window.innerHeight - rect.top + 8}px`;
      } else {
        this.panelTop = `${rect.bottom + 8}px`;
        this.panelBottom = null;
      }
      this.panelLeft = `${left}px`;
      this.panelRight = "auto";
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
