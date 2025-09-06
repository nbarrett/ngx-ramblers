import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { BasicMedia, Media } from "../../../models/ramblers-walks-manager";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { SvgComponent } from "../../../modules/common/svg/svg";
import { NgClass } from "@angular/common";
import { CardImageComponent } from "../../../modules/common/card/image/card-image";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { move } from "../../../functions/arrays";
import last from "lodash-es/last";
import first from "lodash-es/first";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

@Component({
    selector: "app-group-event-images",
    template: `
      <div class="pointer" [tooltip]="currentBasicMedia()?.alt" [placement]="'bottom'">
        <div class="d-flex align-items-center">
          @if (extendedGroupEvent?.groupEvent?.media?.length > 1) {
            <div>
              <app-svg colour="rgb(155, 200, 171)" (click)="back()"
                       [disabled]="backDisabled()"
                       height="20"
                       icon="i-back-round"/>
              <span class="visually-hidden">Previous slide</span>
              <span class="px-2">Image {{ imageIndex + 1 }}
                of {{ extendedGroupEvent?.groupEvent?.media?.length }}</span>
              <app-svg colour="rgb(155, 200, 171)" (click)="next()"
                       [disabled]="forwardDisabled()"
                       height="20"
                       icon="i-forward-round"/>

              <span class="visually-hidden">Next slide</span>
            </div>
          }
          @if (allowEditImage) {
            <div class="d-flex justify-content-center align-items-center mx-3">
              <span class="px-2">Remove image {{ imageIndex + 1 }}</span>
              <app-svg colour="rgb(255, 0, 0)" (click)="removeImage()"
                       [disabled]="deleteDisabled()"
                       height="20"
                       icon="i-cross"
                       [tooltip]="'Remove this image'"/>
            </div>
            @if (extendedGroupEvent?.groupEvent?.media?.length > 1) {
              <div class="ms-auto">
                <app-svg [tooltip]="backDisabled()? '':'move this image back to position '+ imageIndex"
                         colour="rgb(155, 200, 171)" (click)="moveImageBack()"
                         [disabled]="backDisabled()"
                         height="20"
                         icon="i-up"/>
                <span class="px-2">Reorder image {{ imageIndex + 1 }}</span>
                <app-svg [tooltip]="forwardDisabled()?'':'move this image forward to position '+(imageIndex + 2)"
                         colour="rgb(155, 200, 171)"
                         (click)="moveImageForward()"
                         [disabled]="forwardDisabled()"
                         height="20"
                         icon="i-down"/>
              </div>
            }
          }
        </div>
        @if (allowEditImage) {
          <input id="edit-image-{{extendedGroupEvent.id}}" type="submit"
                 value="edit"
                 (click)="this.mediaChanged.emit(currentMedia())"
                 class="btn btn-primary button-edit-image">
        }
        <div [ngClass]="extendedGroupEvent?.groupEvent?.media?.length > 1 ? 'mt-2': 'mt-3'">
          <app-card-image fixedHeight [imageSource]="imageSourceOrPreview()"/>
        </div>
      </div>`,
    styleUrls: ["./walk-view.sass"],
  imports: [TooltipDirective, SvgComponent, NgClass, CardImageComponent]
})

export class GroupEventImages implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventImages", NgxLoggerLevel.ERROR);
  mediaQueryService = inject(MediaQueryService);
  imagePreview: string;
  protected allowEditImage: boolean;
  protected imageIndex = 0;
  @Output() mediaChanged = new EventEmitter<Media>();
  protected extendedGroupEvent: ExtendedGroupEvent;

  @Input("extendedGroupEvent") set extendedGroupEventValue(extendedGroupEvent: ExtendedGroupEvent) {
    this.extendedGroupEvent = extendedGroupEvent;
    this.imageIndex = 0;
    this.logger.info("extendedGroupEventValue:extendedGroupEvent", this.extendedGroupEvent, "imageIndex:", this.imageIndex);
  }

  @Input("imagePreview") set imagePreviewValue(imagePreview: string) {
    this.imagePreview = imagePreview;
    this.logger.info("imagePreviewValue", imagePreview);
  }

  @Input("allowEditImage") set allowEditImageValue(allowEditImage: boolean) {
    this.allowEditImage = coerceBooleanProperty(allowEditImage);
  }

  ngOnInit() {
    this.logger.info("ngOnInit: extendedGroupEvent", this.extendedGroupEvent, "imageIndex:", this.imageIndex);
  }

  removeImage() {
    this.logger.info("removing image:", this.extendedGroupEvent?.groupEvent?.media[this.imageIndex]);
    this.extendedGroupEvent?.groupEvent?.media.splice(this.imageIndex, 1);
    this.imageIndex = Math.max(0, this.imageIndex - 1);
  }

  back() {
    if (this.imageIndex > 0) {
      this.logger.info("back: current image index:", this.imageIndex);
      this.imageIndex--;
    } else {
      this.logger.info("back: already at the first image, index:", this.imageIndex);
    }
  }

  next() {
    if (this.imageIndex < this.extendedGroupEvent?.groupEvent?.media?.length - 1) {
      this.logger.info("next: current image index:", this.imageIndex);
      this.imageIndex++;
    } else {
      this.logger.info("next: already at the last image, index:", this.imageIndex);
    }
  }

  backDisabled() {
    return this.imageIndex === 0;
  }

  forwardDisabled() {
    return this.imageIndex >= this.extendedGroupEvent?.groupEvent?.media?.length - 1;
  }

  imageSourceOrPreview(): string {
    return this.imagePreview || this.currentBasicMedia()?.url;
  }

  currentBasicMedia(): BasicMedia {
    return this.mediaQueryService.basicMediaFrom(this.extendedGroupEvent?.groupEvent)?.[this.imageIndex];
  }

  currentMedia(): Media {
    return this.extendedGroupEvent?.groupEvent?.media[this.imageIndex];
  }

  moveImageForward() {
    const item = this.currentMedia();
    if (this.canMoveForward(this.extendedGroupEvent?.groupEvent?.media, item)) {
      this.logger.info("about to move forward image:", item, "with index:", this.imageIndex, "in media:", this.extendedGroupEvent?.groupEvent?.media);
      move(this.extendedGroupEvent?.groupEvent?.media, this.imageIndex, this.imageIndex + 1);
      this.logger.info("moved forward image:", item, "in index:", this.extendedGroupEvent?.groupEvent?.media.indexOf(item), "in media:", this.extendedGroupEvent?.groupEvent?.media);
      this.imageIndex = this.extendedGroupEvent?.groupEvent?.media.indexOf(item);
    }
  }

  private canMoveForward(media: Media[], item: Media) {
    return last(media) !== item;
  }

  moveImageBack() {
    const item = this.currentMedia();
    if (this.canMoveBack(this.extendedGroupEvent?.groupEvent?.media, item)) {
      this.logger.info("about to move back image:", item, "in index:", this.imageIndex);
      move(this.extendedGroupEvent?.groupEvent?.media, this.imageIndex, this.imageIndex - 1);
      this.imageIndex = this.extendedGroupEvent?.groupEvent?.media.indexOf(item);
    }
  }

  private canMoveBack(media: Media[], item: Media) {
    return first(media) !== item;
  }

  deleteDisabled() {
    return this.imageIndex < 0 || this.extendedGroupEvent?.groupEvent?.media.length === 0;
  }
}
