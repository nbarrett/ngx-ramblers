import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfig } from "../../../../models/system.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AspectRatioSelectorComponent } from "../../../../carousel/edit/aspect-ratio-selector/aspect-ratio-selector";
import { FileSizeSelectorComponent } from "../../../../carousel/edit/file-size-selector/file-size-selector";

@Component({
  selector: "[app-image-settings]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Image List Defaults</div>
        @if (config?.images?.imageLists) {
          <div class="col-sm-12">
            <app-aspect-ratio-selector label="Default Aspect Ratio"
                                       [dimensionsDescription]="config.images.imageLists.defaultAspectRatio"
                                       (dimensionsChanged)="config.images.imageLists.defaultAspectRatio=($event.description)"/>
          </div>
          <div class="col-sm-12 my-3">
            <app-file-size-selector label="Default Maximum Image Size"
                                    [fileSize]="config.images.imageLists.defaultMaxImageSize"
                                    (fileSizeChanged)="config.images.imageLists.defaultMaxImageSize=$event"/>
          </div>
        } @else {
          <div class="col-sm-12">
            <app-badge-button (click)="config.images=systemConfigService.imagesDefaults()"
                              [icon]="faAdd" caption="No Image List Defaults - Create"/>
          </div>
        }
      </div>
    </div>`,
  imports: [BadgeButtonComponent, ReactiveFormsModule, FormsModule, AspectRatioSelectorComponent, FileSizeSelectorComponent]
})
export class ImageSettings implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("ImageCollectionSettingsComponent", NgxLoggerLevel.ERROR);
  protected systemConfigService = inject(SystemConfigService);
  faAdd = faAdd;
  @Input() config: SystemConfig;

  protected readonly JSON = JSON;

  ngOnInit() {
    this.logger.info("constructed:config:", this.config);
  }
}
