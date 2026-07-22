import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { Subscription } from "rxjs";
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
import { last } from "es-toolkit/compat";
import { first } from "es-toolkit/compat";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { WalkDetailsImageStyle } from "../../../models/walks-config.model";
import { FocalPointPickerComponent } from "../../../modules/common/focal-point-picker/focal-point-picker";
import { FocalPoint } from "../../../models/image-cropper.model";
import { SwipeableDirective } from "../../../modules/common/swipe/swipeable.directive";

@Component({
    selector: "app-group-event-images",
    template: `
      <div class="pointer" [tooltip]="currentBasicMedia()?.alt" [placement]="'bottom'">
        <div class="d-flex align-items-center flex-nowrap">
          @if (extendedGroupEvent?.groupEvent?.media?.length > 1) {
            <div class="d-flex align-items-center flex-shrink-0">
              <app-svg [colour]="mintcakeColor" (click)="back()"
                       [disabled]="backDisabled()"
                       height="20"
                       icon="i-back-round"/>
              <span class="visually-hidden">Previous slide</span>
              <span class="px-2 text-nowrap">Image {{ imageIndex + 1 }}
                of {{ extendedGroupEvent?.groupEvent?.media?.length }}</span>
              <app-svg [colour]="mintcakeColor" (click)="next()"
                       [disabled]="forwardDisabled()"
                       height="20"
                       icon="i-forward-round"/>
              <span class="visually-hidden">Next slide</span>
            </div>
          }
          @if (allowEditImage) {
            <div class="d-flex align-items-center mx-3 flex-shrink-0">
              <span class="px-2 text-nowrap">Remove image {{ imageIndex + 1 }}</span>
              <app-svg [colour]="removeColor" (click)="removeImage()"
                       [disabled]="deleteDisabled()"
                       height="20"
                       icon="i-cross"
                       [tooltip]="'Remove this image'"/>
            </div>
            @if (extendedGroupEvent?.groupEvent?.media?.length > 1) {
              <div class="d-flex align-items-center ms-auto flex-shrink-0">
                <app-svg [tooltip]="backDisabled()? '':'move this image back to position '+ imageIndex"
                         [colour]="mintcakeColor" (click)="moveImageBack()"
                         [disabled]="backDisabled()"
                         height="20"
                         icon="i-up"/>
                <span class="px-2 text-nowrap">Reorder image {{ imageIndex + 1 }}</span>
                <app-svg [tooltip]="forwardDisabled()?'':'move this image forward to position '+(imageIndex + 2)"
                         [colour]="mintcakeColor"
                         (click)="moveImageForward()"
                         [disabled]="forwardDisabled()"
                         height="20"
                         icon="i-down"/>
              </div>
            }
          }
        </div>
        <div class="position-relative" [ngClass]="extendedGroupEvent?.groupEvent?.media?.length > 1 ? 'mt-2': 'mt-3'">
          @if (swipeableImages()) {
            <div class="swiper-viewport" appSwipeable
                 (draggingChange)="dragging = $event"
                 (swipeOffset)="dragOffsetX = $event"
                 (swipeDelta)="onSwipeDelta($event)">
              <div class="swiper-strip"
                   [class.dragging]="dragging"
                   [style.transform]="stripTransform"
                   [style.transition]="dragTransition">
                @for (basicMedia of allBasicMedia(); track basicMedia.url; let slideIndex = $index) {
                  <div class="swiper-slide">
                    <app-card-image [unconstrainedHeight]="naturalImageHeight"
                                    [height]="naturalImageHeight ? null : croppedImageHeight"
                                    [focalPoint]="naturalImageHeight ? null : mediaAt(slideIndex)?.focalPoint"
                                    [imageSource]="basicMedia.url"/>
                  </div>
                }
              </div>
            </div>
          } @else {
            <app-card-image [unconstrainedHeight]="naturalImageHeight"
                            [height]="naturalImageHeight ? null : croppedImageHeight"
                            [focalPoint]="naturalImageHeight ? null : currentMedia()?.focalPoint"
                            [imageSource]="imageSourceOrPreview()"/>
          }
          @if (allowEditImage) {
            <input id="edit-image-{{extendedGroupEvent.id}}" type="submit"
                   value="edit"
                   (click)="this.mediaChanged.emit(currentMedia())"
                   class="btn btn-primary position-absolute top-0 end-0 m-2">
          }
        </div>
        @if (allowEditImage && !naturalImageHeight && currentMedia()) {
          <div class="form-group mt-3">
            <label class="form-label">Focal point for image {{ imageIndex + 1 }}</label>
            <app-focal-point-picker
              [imageSrc]="imageSourceOrPreview()"
              [minZoom]="0.2"
              [maxPreviewHeight]="260"
              [focalPoint]="currentMedia().focalPoint || defaultFocalPoint"
              (focalPointChange)="focalPointChanged($event)"/>
          </div>
        }
      </div>`,
    styleUrls: ["./walk-view.sass"],
    styles: [`
      .swiper-viewport
        overflow: hidden
        -webkit-user-select: none
        user-select: none

        img
          pointer-events: none
          -webkit-user-drag: none

      .swiper-strip
        display: flex
        align-items: flex-start
        cursor: grab
        &.dragging
          cursor: grabbing

      .swiper-slide
        flex: 0 0 100%
    `],
  imports: [TooltipDirective, SvgComponent, NgClass, CardImageComponent, FocalPointPickerComponent, SwipeableDirective]
})

export class GroupEventImages implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventImages", NgxLoggerLevel.ERROR);
  mediaQueryService = inject(MediaQueryService);
  private walksConfigService = inject(WalksConfigService);
  private subscriptions: Subscription[] = [];
  protected naturalImageHeight = false;
  protected croppedImageHeight = 200;
  protected readonly defaultFocalPoint: FocalPoint = {x: 50, y: 50, zoom: 1};
  protected dragging = false;
  protected dragOffsetX = 0;
  imagePreview: string;
  protected allowEditImage: boolean;
  protected imageIndex = 0;
  protected readonly mintcakeColor = "var(--ramblers-colour-mintcake)";
  protected readonly removeColor = "rgb(255, 0, 0)";
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
    this.subscriptions.push(this.walksConfigService.events().subscribe(walksConfig => {
      this.naturalImageHeight = walksConfig?.walkDetailsImageStyle === WalkDetailsImageStyle.NATURAL;
      this.croppedImageHeight = walksConfig?.walkDetailsImageHeight || 200;
    }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
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

  focalPointChanged(focalPoint: FocalPoint) {
    const media = this.currentMedia();
    if (media) {
      media.focalPoint = focalPoint || null;
    }
  }

  swipeableImages(): boolean {
    return !this.imagePreview && this.extendedGroupEvent?.groupEvent?.media?.length > 1;
  }

  allBasicMedia(): BasicMedia[] {
    return this.mediaQueryService.basicMediaFrom(this.extendedGroupEvent?.groupEvent) || [];
  }

  mediaAt(index: number): Media {
    return this.extendedGroupEvent?.groupEvent?.media?.[index];
  }

  onSwipeDelta(deltaX: number): void {
    if (deltaX < 0) {
      this.next();
    } else {
      this.back();
    }
  }

  get stripTransform(): string {
    return `translateX(calc(${-this.imageIndex * 100}% + ${this.dragOffsetX}px))`;
  }

  get dragTransition(): string {
    return this.dragging ? "none" : "transform 0.3s ease-out";
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
