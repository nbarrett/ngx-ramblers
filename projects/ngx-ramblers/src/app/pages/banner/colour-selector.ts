import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { HasClass } from "../../models/banner-configuration.model";
import { ColourSelector, colourSelectors } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";

@Component({
  selector: "app-colour-selector",
  styleUrls: ["./colour-selector.sass"],
  template: `
    <div class="row">
      <div class="col-md-12">
        <label for="colour-selector">Colour:</label>
        <ng-select [(ngModel)]="itemWithClass.class" (ngModelChange)="audit()" appearance="outline" [searchable]="false" [clearable]="false" labelForId="colour-selector">
          <ng-option *ngFor="let colour of colours" [value]="colour.class">
            <span [class]="colour.badgeClass">{{colour.name}}</span>
          </ng-option>
        </ng-select>
      </div>
    </div>
  `
})

export class ColourSelectorComponent implements OnInit {
  private logger: Logger;

  constructor(private stringUtils: StringUtilsService,
              private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ColourSelectorComponent, NgxLoggerLevel.OFF);
  }

  @Input() itemWithClass: HasClass;
  colours: ColourSelector[] = colourSelectors;

  ngOnInit() {
    this.logger.debug("ngOnInit");
  }

  audit() {
    this.logger.info("colour:", this.itemWithClass.class);
  }
}
