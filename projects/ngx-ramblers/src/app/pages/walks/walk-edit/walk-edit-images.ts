import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfig } from "../../../models/system.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiSwitchModule } from "ngx-ui-switch";
import { DEFAULT_BASIC_EVENT_SELECTION } from "../../../models/search.model";
import { DisplayedWalk, ImageSource } from "../../../models/walk.model";
import { WalkImagesComponent } from "../walk-view/walk-images";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { WalkImageSelectionWalksManagerComponent } from "./walk-images-selection-walks-manager";

@Component({
  selector: "[app-walk-edit-images]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row">
        <div class="col-md-6">
          <div class="form-group">
            <div class="d-flex align-items-center">
              <label class="label mr-2" for="radio-selections">Image Selection:</label>
              <div id="radio-selections">
                @for (source of imageSources; track source.key) {
                  <div class="custom-control custom-radio custom-control-inline">
                    <input class="custom-control-input"
                           id="image-source-{{source.key}}"
                           name="image-source"
                           type="radio"
                           [value]="source.key"
                           (ngModelChange)="imageSourceChanged($event)"
                           [(ngModel)]="displayedWalk.walk.imageConfig.source"/>
                    <label class="custom-control-label"
                           for="image-source-{{source.key}}">
                      {{ stringUtils.asTitle(source.value) }}
                    </label>
                  </div>
                }
              </div>
            </div>
          </div>
          @if (displayedWalk?.walk?.imageConfig.source === ImageSource.WALKS_MANAGER) {
            <app-walk-images-selection-walks-manager [displayedWalk]="displayedWalk"/>
          }
        </div>
        <div class="col-md-6">
          <div class="row">
            <div class="col-sm-12">
              @if (displayedWalk?.walk?.media?.length > 0) {
                <app-walk-images [displayedWalk]="displayedWalk"/>
              }
            </div>
          </div>
        </div>
      </div>
    </div>`,
  imports: [UiSwitchModule, WalkImagesComponent, WalkImageSelectionWalksManagerComponent]
})
export class WalkEditImagesComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditImagesComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  dateUtils = inject(DateUtilsService);

  @Input() config: SystemConfig;
  @Input() displayedWalk!: DisplayedWalk;
  imageSources: KeyValue<string>[] = enumKeyValues(ImageSource);
  ImageSource = ImageSource;

  async ngOnInit() {
    this.logger.info("constructed with:config:", this.config, "this.displayedWalk:", this.displayedWalk);
    const defaultImageConfig = {
      source: ImageSource.NONE,
      importFrom: {
        areaCode: this.config.area.groupCode,
        groupCode: this.config.group.groupCode,
        filterParameters: DEFAULT_BASIC_EVENT_SELECTION(),
        walkId: null
      }
    };
    const setDefaults = (target: any, defaults: any) => {
      if (!target || typeof target !== "object" || !defaults || typeof defaults !== "object") {
        this.logger.info("setDefaults:target:", target, "defaults:", defaults, "(target is not an object)");
      } else {
        Object.keys(defaults).forEach((key) => {
          this.logger.info("setDefaults:key:", key, "value:", target[key], "defaults value:", defaults[key]);
          if (!target[key]) {
            target[key] = defaults[key];
          } else if (typeof defaults[key] === "object" && !Array.isArray(defaults[key])) {
            setDefaults(target[key], defaults[key]);
          }
        });
      }
    };

    if (!this.displayedWalk.walk.imageConfig) {
      this.displayedWalk.walk.imageConfig = {...defaultImageConfig};
    } else {
      setDefaults(this.displayedWalk.walk.imageConfig, defaultImageConfig);
    }
  }

  imageSourceChanged(imageSource: ImageSource) {
    this.logger.info("imageSourceChanged:", imageSource, "this.displayedWalk?.walk?.imageConfig.source", this.displayedWalk?.walk?.imageConfig.source);
    if (imageSource === ImageSource.NONE && this.displayedWalk.walk.media.length > 0) {
      this.logger.info("Clearing images:", this.displayedWalk.walk.media);
      this.displayedWalk.walk.media = [];
      this.displayedWalk.walk.imageConfig.importFrom.walkId = null;
    } else {
      this.logger.info("No change to media required:", this.displayedWalk.walk.media);
    }
  }
}
