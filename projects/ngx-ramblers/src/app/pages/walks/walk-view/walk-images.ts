import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { DisplayedWalk } from "../../../models/walk.model";
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

@Component({
    selector: "app-walk-images",
    template: `
      <div class="pointer" [tooltip]="currentBasicMedia()?.alt" [placement]="'bottom'">
        <div class="d-flex align-items-center">
          @if (displayedWalk?.walk?.media?.length > 1) {
            <div>
              <app-svg colour="rgb(155, 200, 171)" (click)="back()"
                       [disabled]="backDisabled()"
                       height="20"
                       icon="i-back-round"/>
              <span class="sr-only">Previous slide</span>
              <span class="px-2">Image {{ imageIndex + 1 }} of {{ displayedWalk?.walk?.media?.length }}</span>
              <app-svg colour="rgb(155, 200, 171)" (click)="next()"
                       [disabled]="forwardDisabled()"
                       height="20"
                       icon="i-forward-round"/>

              <span class="sr-only">Next slide</span>
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
            @if (displayedWalk?.walk?.media?.length > 1) {
              <div class="ml-auto">
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
          <input id="edit-image-{{displayedWalk.walk.id}}" type="submit"
                 value="edit"
                 (click)="this.mediaChanged.emit(currentMedia())"
                 class="btn btn-primary button-edit-image">
        }
        <div [ngClass]="displayedWalk?.walk?.media?.length > 1 ? 'mt-2': 'mt-3'">
          <app-card-image fixedHeight [imageSource]="imageSourceOrPreview()"/>
        </div>
      </div>`,
    styleUrls: ["./walk-view.sass"],
  imports: [TooltipDirective, SvgComponent, NgClass, CardImageComponent]
})

export class WalkImagesComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkImagesComponent", NgxLoggerLevel.ERROR);
  mediaQueryService = inject(MediaQueryService);
  @Output() mediaChanged = new EventEmitter<Media>();
  @Input() displayedWalk: DisplayedWalk;

  @Input("imagePreview") set imagePreviewValue(imagePreview: string) {
    this.imagePreview = imagePreview;
    this.logger.info("imagePreviewValue", imagePreview);
  }

  @Input("allowEditImage") set allowEditImageValue(allowEditImage: boolean) {
    this.allowEditImage = coerceBooleanProperty(allowEditImage);
  }

  imagePreview: string;
  protected allowEditImage: boolean;
  protected imageIndex = 0;

  removeImage() {
    this.logger.info("removing image:", this.displayedWalk?.walk?.media[this.imageIndex]);
    this.displayedWalk.walk.media.splice(this.imageIndex, 1);
    this.imageIndex = Math.max(0, this.imageIndex - 1);
  }

  back() {
    if (this.imageIndex > 0) {
      this.imageIndex--;
    }
  }

  backDisabled() {
    return this.imageIndex === 0;
  }

  forwardDisabled() {
    return this.imageIndex >= this.displayedWalk?.walk?.media?.length - 1;
  }

  imageSourceOrPreview(): string {
    return this.imagePreview || this.currentBasicMedia()?.url;
  }

  currentBasicMedia(): BasicMedia {
    return this.mediaQueryService.basicMediaFrom(this.displayedWalk.walk)[this.imageIndex];
  }

  currentMedia(): Media {
    return this.displayedWalk?.walk?.media[this.imageIndex];
  }

  next() {
    if (this.imageIndex < this.displayedWalk?.walk?.media?.length - 1) {
      this.imageIndex++;
    }
  }

  moveImageForward() {
    const item = this.currentMedia();
    if (this.canMoveForward(this.displayedWalk?.walk?.media, item)) {
      this.logger.info("about to move forward image:", item, "with index:", this.imageIndex, "in media:", this.displayedWalk?.walk?.media);
      move(this.displayedWalk?.walk?.media, this.imageIndex, this.imageIndex + 1);
      this.logger.info("moved forward image:", item, "in index:", this.displayedWalk?.walk?.media.indexOf(item), "in media:", this.displayedWalk?.walk?.media);
      this.imageIndex = this.displayedWalk?.walk?.media.indexOf(item);
    }
  }

  private canMoveForward(media: Media[], item: Media) {
    return last(media) !== item;
  }

  moveImageBack() {
    const item = this.currentMedia();
    if (this.canMoveBack(this.displayedWalk?.walk?.media, item)) {
      this.logger.info("about to move back image:", item, "in index:", this.imageIndex);
      move(this.displayedWalk?.walk?.media, this.imageIndex, this.imageIndex - 1);
      this.imageIndex = this.displayedWalk?.walk?.media.indexOf(item);
    }
  }

  private canMoveBack(media: Media[], item: Media) {
    return first(media) !== item;
  }

  deleteDisabled() {
    return this.imageIndex < 0 || this.displayedWalk?.walk?.media.length === 0;
  }
}
