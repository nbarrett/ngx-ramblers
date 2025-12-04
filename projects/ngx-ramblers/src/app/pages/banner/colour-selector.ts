import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { HasClass, HasColour } from "../../models/banner-configuration.model";
import { ColourSelector, colourSelectors } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgOptionComponent, NgSelectComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";
import { NumberUtilsService } from "../../services/number-utils.service";
import { isUndefined } from "es-toolkit/compat";

@Component({
    selector: "app-colour-selector",
    styles: [`
    @use "../../assets/styles/colours" as *

    .badge-fixed-width
      width: 100px

    .badge-mintcake
      @extend .badge-fixed-width
      @extend .text-style-mintcake

    .badge-rosycheeks
      @extend .badge-fixed-width
      @extend .text-style-rosycheeks

    .badge-sunset
      @extend .badge-fixed-width
      @extend .text-style-sunset

    .badge-grey
      @extend .badge-fixed-width
      @extend .text-style-grey

    .badge-sunrise
      @extend .badge-fixed-width
      @extend .text-style-sunrise

    .badge-cloudy
      @extend .badge-fixed-width
      @extend .text-style-cloudy

    .badge-granite
      @extend .badge-fixed-width
      @extend .text-style-granite

    ng-select.ng-select-disabled
      opacity: 0.6
      background-color: #e9ecef
      pointer-events: none
      .ng-select-container
        background-color: #e9ecef
        cursor: not-allowed
  `],
    template: `
    <div class="row">
      <div class="col-md-12">
        @if (!noLabel ) {
          <label for="{{uniqueId}}">{{ label }}</label>
        }
        @if (itemWithClassOrColour) {
          <ng-select
            [ngModel]="this.hasClass(this.itemWithClassOrColour) ? this.itemWithClassOrColour.class : this.itemWithClassOrColour.colour"
            (change)="change($event)"
            appearance="outline"
            [clearable]="false"
            [disabled]="disabled"
            labelForId="{{uniqueId}}"
            [virtualScroll]="true"
            [bufferAmount]="30">
            @for (colour of colours; track colour.colour) {
              <ng-option
                [value]="this.hasClass(this.itemWithClassOrColour) ? colour.class : colour.colour">
                <span [class]="colour.badgeClass">{{ colour.name }}</span>
              </ng-option>
            }
          </ng-select>
        }
        @if (!itemWithClassOrColour) {
          <div>No item to configure</div>
        }
      </div>
    </div>
    `,
    imports: [NgSelectComponent, FormsModule, NgOptionComponent]
})

export class ColourSelectorComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("ColourSelectorComponent", NgxLoggerLevel.ERROR);
  public itemWithClassOrColour: HasClass | HasColour;
  public noLabel: boolean;
  public disabled: boolean;
  private numberUtilsService: NumberUtilsService = inject(NumberUtilsService);
  public uniqueId: string = this.numberUtilsService.generateUid();
  @Input()
  public colours: ColourSelector[] = colourSelectors;
  @Input()
  label = "Colour";

  @Input("noLabel") set noLabelValue(value: boolean) {
    this.noLabel = coerceBooleanProperty(value);
  }

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Input("itemWithClassOrColour") set valueForHasClass(hasClassOrColour: HasClass | HasColour) {
    if (hasClassOrColour) {
      this.logger.info("hasClassOrColour set to:", hasClassOrColour);
      this.itemWithClassOrColour = hasClassOrColour;
    }
  }

  hasClass(data: any): data is HasClass {
    return !isUndefined((data as HasClass)?.class);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:itemWithClassOrColour:", this.itemWithClassOrColour, "hasClass:", this.hasClass(this.itemWithClassOrColour), "colours:", this.colours);
  }

  audit() {
    this.logger.info("audit", this.hasClass(this.itemWithClassOrColour) ? "class:" : "colour:", this.hasClass(this.itemWithClassOrColour) ? this.itemWithClassOrColour.class : this.itemWithClassOrColour.colour, "itemWithClassOrColour:", this.itemWithClassOrColour);
  }

  change(value: any) {
    if (this.hasClass(this.itemWithClassOrColour)) {
      this.itemWithClassOrColour.class = value;
    } else {
      this.itemWithClassOrColour.colour = value;
    }
    this.logger.info("change:value:", value, "itemWithClassOrColour:", this.itemWithClassOrColour);
  }
}
