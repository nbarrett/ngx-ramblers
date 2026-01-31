import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { first } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { ensureTitleLine, TitleLine } from "../../models/banner-configuration.model";
import { Images, SystemConfig } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { FormsModule } from "@angular/forms";
import { IconSelectorComponent } from "./icon-selector";
import { BannerTitlePartConfigComponent } from "./banner-title-part-config.component";

@Component({
    selector: "app-banner-title-config",
    styleUrls: ["./banner.component.sass"],
    template: `
    @if (titleLine) {
      <h4>
        <div class="form-check">
          <input class="form-check-input"
                 [(ngModel)]="titleLine.include"
                 type="checkbox"
                 id="show-title-{{id}}">
          <label class="form-check-label"
                 for="show-title-{{id}}">Line {{id}}</label>
        </div>
      </h4>
      <div class="row">
        <div class="col-sm-6">
          <div class="form-check">
            <input class="form-check-input"
                   [(ngModel)]="titleLine.showIcon" type="checkbox" id="show-icon-{{id}}">
            <label class="form-check-label"
                   for="show-icon-{{id}}">Prefix with icon</label>
          </div>
          <app-icon-selector [titleLine]="titleLine" label="Prefix with icon"></app-icon-selector>
        </div>
        <div class="col-sm-6">
          <label>Font Size:</label>
          <input [(ngModel)]="titleLine.fontSize"
                 type="number" class="form-control input-sm">
        </div>
      </div>
      <app-banner-title-part-config [titlePart]="titleLine.part1" id="1"></app-banner-title-part-config>
      <app-banner-title-part-config [titlePart]="titleLine.part2" id="2"></app-banner-title-part-config>
      <app-banner-title-part-config [titlePart]="titleLine.part3" id="3"></app-banner-title-part-config>
    }
  `,
    imports: [FormsModule, IconSelectorComponent, BannerTitlePartConfigComponent]
})

export class BannerTitleConfigComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("BannerTitleConfigComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private titleLineValue: TitleLine = ensureTitleLine(null);
  @Input()
  set titleLine(value: TitleLine) {
    this.titleLineValue = ensureTitleLine(value || null);
  }
  get titleLine(): TitleLine {
    return this.titleLineValue;
  }
  @Input()
  public id: string;
  private icons: Images;
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.logger.debug("ngOnInit");

    this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.icons = config.icons;
        this.logger.info("retrieved icons", this.icons);
        if (!this?.titleLine?.image && this.titleLine) {
          this.titleLine.image = first(this.icons.images);
        }
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
