import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BannerTextItem } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { ColourSelectorComponent } from "./colour-selector";

@Component({
    selector: "app-banner-title-part-config",
    styleUrls: ["./banner.component.sass"],
    template: `
      @if (titlePart) {
        <div class="row">
          <div class="col-sm-6">
            <label class="mr-2" for="{{id}}-include">Part {{ id }}:</label>
            <input id="{{id}}-include" type="text" [(ngModel)]="titlePart.value" class="form-control mr-2">
          </div>
          <div class="col-sm-6">
            <app-colour-selector [itemWithClassOrColour]="titlePart"/>
          </div>
        </div>
      }`,
    imports: [FormsModule, ColourSelectorComponent]
})

export class BannerTitlePartConfigComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("BannerTitlePartConfigComponent", NgxLoggerLevel.ERROR);

  @Input()
  public titlePart: BannerTextItem;
  @Input()
  public id: string;

  ngOnInit() {
    this.logger.debug("ngOnInit");
  }

}

