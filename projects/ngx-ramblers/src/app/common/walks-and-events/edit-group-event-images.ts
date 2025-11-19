import { booleanAttribute, Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { RootFolder, SystemConfig } from "../../models/system.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { UiSwitchModule } from "ngx-ui-switch";
import { ImageSource } from "../../models/walk.model";
import { GroupEventImages } from "../../pages/walks/walk-view/group-event-images";
import { enumKeyValues, KeyValue } from "../../functions/enums";
import {
  EventImageSelectionForWalksManager
} from "../../pages/walks/walk-edit/event-image-selection-for-walks-manager";
import { ImageCropperAndResizerComponent } from "../../image-cropper-and-resizer/image-cropper-and-resizer";
import { AwsFileData } from "../../models/aws-object.model";
import { AlertInstance } from "../../services/notifier.service";
import { Media } from "../../models/ramblers-walks-manager";
import { MediaQueryService } from "../../services/committee/media-query.service";
import { EditMode } from "../../models/ui-actions";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { EventDefaultsService } from "../../services/event-defaults.service";
import { isNull, isObject, isUndefined } from "es-toolkit/compat";

@Component({
  selector: "[app-edit-group-event-images]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row">
        <div class="col-md-6">
          @if (extendedGroupEvent?.fields?.imageConfig?.source && !disallowImageSourceSelection) {
            <div class="form-group">
              <div class="d-flex align-items-center">
                <label class="label me-2" for="radio-selections">Image Selection:</label>
                <div id="radio-selections">
                  @for (source of imageSources; track source.key) {
                    <div class="form-check form-check-inline">
                      <input class="form-check-input"
                             id="image-source-{{source.key}}"
                             name="image-source"
                             type="radio"
                             [value]="source.key"
                             (ngModelChange)="imageSourceChanged($event)"
                             [(ngModel)]="extendedGroupEvent.fields.imageConfig.source"/>
                      <label class="form-check-label"
                             for="image-source-{{source.key}}">
                        {{ stringUtils.asTitle(source.value) }}
                      </label>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
          @if (extendedGroupEvent?.fields?.imageConfig?.source === ImageSource.LOCAL) {
            <input id="add-image-{{extendedGroupEvent.id}}" type="submit"
                   value="add"
                   (click)="createNewImage()"
                   class="btn btn-primary">
          }
          @if (extendedGroupEvent?.fields?.imageConfig?.source === ImageSource.WALKS_MANAGER) {
            <app-walk-images-selection-walks-manager [groupEvent]="extendedGroupEvent"/>
          }
        </div>
        <div class="col-md-6">
          <div class="row">
            <div class="col-sm-12">
              @if (extendedGroupEvent?.groupEvent?.media?.length > 0 || awsFileData?.image) {
                <app-group-event-images [imagePreview]="awsFileData?.image" [extendedGroupEvent]="extendedGroupEvent"
                                 (mediaChanged)="mediaChanged($event)" allowEditImage/>
              }
            </div>
          </div>
        </div>
        @if (editMode) {
          <div class="col-sm-12 mt-4">
            <app-image-cropper-and-resizer wrapButtons
                                           [rootFolder]="rootFolder"
                                           [preloadImage]="imageSourceOrPreview()"
                                           (imageChange)="imageChanged($event)"
                                           (error)="imageCroppingError($event)"
                                           (cropError)="imageCroppingError($event)"
                                           (quit)="exitImageEdit()"
                                           (save)="imagedSaved($event)"/>
          </div>
        }
      </div>
    </div>`,
  imports: [UiSwitchModule, GroupEventImages, EventImageSelectionForWalksManager, ImageCropperAndResizerComponent]
})
export class EditGroupEventImagesComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("EditGroupEventImagesComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  dateUtils = inject(DateUtilsService);
  mediaQueryService = inject(MediaQueryService);
  private eventDefaultsService = inject(EventDefaultsService);
  @Input() config: SystemConfig;
  @Input() extendedGroupEvent!: ExtendedGroupEvent;
  @Input() rootFolder: RootFolder;
  @Input() private notify: AlertInstance;
  @Input({transform: booleanAttribute}) public disallowImageSourceSelection = false;
  imageSources: KeyValue<string>[] = enumKeyValues(ImageSource);
  ImageSource = ImageSource;
  public editMode: EditMode;
  public awsFileData: AwsFileData;
  public media: Media;
  protected readonly RootFolder = RootFolder;

  async ngOnInit() {
    this.logger.info("constructed with:config:", this.config, "this.groupEvent:", this.extendedGroupEvent, "disallowImageSourceSelection:", this.disallowImageSourceSelection);
    const defaultImageConfig = this.eventDefaultsService.defaultImageConfig(this.disallowImageSourceSelection ? ImageSource.LOCAL : ImageSource.NONE);
    if (!this.extendedGroupEvent.fields.imageConfig) {
      this.logger.info("creating default value for imageConfig:", defaultImageConfig);
      this.extendedGroupEvent.fields.imageConfig = defaultImageConfig;
    } else {
      this.logger.info("applying any required defaults to existing:", this.extendedGroupEvent.fields.imageConfig, "from defaultImageConfig:", defaultImageConfig);
      this.setDefaults(this.extendedGroupEvent.fields.imageConfig, defaultImageConfig);
    }
    if (this.disallowImageSourceSelection && this.extendedGroupEvent.fields.imageConfig.source === ImageSource.NONE) {
      this.extendedGroupEvent.fields.imageConfig.source = ImageSource.LOCAL;
    }
  }

  setDefaults(target: any, defaults: any) {
    if (!isObject(target) || !isObject(defaults)) {
      this.logger.info("setDefaults:target:", target, "defaults:", defaults, "(target is not an object)");
    } else {
      Object.keys(defaults).forEach((key) => {
        if (isUndefined(target[key]) || isNull(target[key])) {
          this.logger.info("setDefaults:key:", key, "setting:", target[key], "to default", defaults[key]);
          target[key] = defaults[key];
        } else if (isObject(defaults[key]) && !Array.isArray(defaults[key])) {
          this.setDefaults(target[key], defaults[key]);
        }
      });
    }
  };

  imageChanged(awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData);
    this.awsFileData = awsFileData;
  }

  imageCroppingError(errorEvent: ErrorEvent) {
    this.notify.error({
      title: "Image cropping error occurred",
      message: (errorEvent ? (". Error was: " + JSON.stringify(errorEvent)) : "")
    });
    this.notify.clearBusy();
  }

  createNewImage() {
    this.editMode = EditMode.ADD_NEW;
    this.awsFileData = null;
    this.media = null;
  }

  exitImageEdit() {
    this.editMode = null;
    this.awsFileData = null;
  }

  imagedSaved(awsFileData: AwsFileData) {
    const imageSource = awsFileData.awsFileName;
    this.logger.info("imagedSaved:", awsFileData, "setting imageSource to", imageSource);
    this.mediaQueryService.applyImageSource(this.extendedGroupEvent?.groupEvent, this.extendedGroupEvent?.groupEvent.title, imageSource);
    this.exitImageEdit();
  }

  imageSourceChanged(imageSource: ImageSource) {
    this.logger.info("imageSourceChanged:", imageSource, "this.groupEvent?.fields?.imageConfig.source", this.extendedGroupEvent?.fields?.imageConfig?.source);
    if (imageSource === ImageSource.NONE && this.extendedGroupEvent?.groupEvent?.media?.length > 0) {
      this.logger.info("Clearing images:", this.extendedGroupEvent?.groupEvent?.media);
      this.extendedGroupEvent.groupEvent.media = [];
      this.extendedGroupEvent.fields.imageConfig.importFrom.walkId = null;
    } else {
      this.logger.info("No change to media required:", this.extendedGroupEvent?.groupEvent.media);
    }
  }

  mediaChanged(media: Media) {
    this.logger.info("mediaChanged:", media);
    this.editMode = media ? EditMode.EDIT : null;
    this.media = media;
  }

  imageSourceOrPreview(): string {
    return this.editMode === EditMode.ADD_NEW ? null : (this.awsFileData?.awsFileName || this.mediaQueryService.basicMediaFrom(this.extendedGroupEvent?.groupEvent)?.[0]?.url);
  }

}
