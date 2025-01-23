import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { HasClass, HasColour } from "../../models/banner-configuration.model";
import { ColourSelector, colourSelectors } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgSelectComponent, NgOptionComponent } from "@ng-select/ng-select";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-colour-selector",
    styles: [`
    @import "../../assets/styles/colours"

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
  `],
    template: `
    <div class="row">
      <div class="col-md-12">
        @if (!noLabel ) {
          <label for="colour-selector">{{ label }}</label>
        }
        @if (itemWithClassOrColour) {
          <ng-select
            [ngModel]="this.hasClass(this.itemWithClassOrColour) ? this.itemWithClassOrColour.class : this.itemWithClassOrColour.colour"
            (change)="change($event)"
            appearance="outline"
            [clearable]="false"
            labelForId="colour-selector"
            [virtualScroll]="true"
            [bufferAmount]="30">
            @for (colour of colours; track colour) {
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
  private logger: Logger;
  public itemWithClassOrColour: HasClass | HasColour;
  public noLabel: boolean;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ColourSelectorComponent, NgxLoggerLevel.ERROR);
  }

  @Input()
  public colours: ColourSelector[] = colourSelectors;
  @Input()
  label = "Colour";

  @Input("noLabel") set noLabelValue(value: boolean) {
    this.noLabel = coerceBooleanProperty(value);
  }

  @Input("itemWithClassOrColour") set valueForHasClass(hasClassOrColour: HasClass | HasColour) {
    if (hasClassOrColour) {
      this.logger.info("hasClassOrColour set to:", hasClassOrColour);
      this.itemWithClassOrColour = hasClassOrColour;
    }
  }

  hasClass(data: any): data is HasClass {
    return (data as HasClass)?.class !== undefined;
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
