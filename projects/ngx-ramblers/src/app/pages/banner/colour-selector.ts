import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { HasClass } from "../../models/banner-configuration.model";
import { ColourSelector, colourSelectors, textStyleSelectors } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

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
        <label *ngIf="!noLabel " for="colour-selector">Colour:</label>
        <ng-select *ngIf="itemWithClass" [(ngModel)]="itemWithClass.class" (ngModelChange)="audit()"
                   appearance="outline"
                   [clearable]="false"
                   labelForId="colour-selector"
                   [virtualScroll]="true"
                   [bufferAmount]="30">
          <ng-option *ngFor="let colour of colours" [value]="colour.class">
            <span [class]="colour.badgeClass">{{ colour.name }}</span>
          </ng-option>
        </ng-select>
        <div *ngIf="!itemWithClass">No item to configure</div>
      </div>
    </div>
  `
})

export class ColourSelectorComponent implements OnInit {
  private logger: Logger;
  public colours: ColourSelector[] = colourSelectors;
  public itemWithClass: HasClass;
  public noLabel: boolean;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ColourSelectorComponent, NgxLoggerLevel.ERROR);
  }

  @Input("noLabel") set noLabelValue(value: boolean) {
    this.noLabel = coerceBooleanProperty(value);
  }

  @Input("textStyleSelectors") set textStyleSelectorsValue(value: boolean) {
    if (coerceBooleanProperty(value)) {
      this.colours = textStyleSelectors;
    }
  }

  @Input("itemWithClass") set valueForHasClass(hasClass: HasClass) {
    if (hasClass) {
      this.logger.info("hasClass set to:", hasClass);
      this.itemWithClass = hasClass;
    }
  }


  ngOnInit() {
    this.logger.info("ngOnInit:", this.itemWithClass);
  }

  audit() {
    this.logger.info("colour:", this.itemWithClass.class);
  }
}
