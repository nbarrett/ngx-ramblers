import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MediaQueryService } from "../../../../services/committee/media-query.service";
import { DisplayedWalk, FALLBACK_MEDIA } from "../../../../models/walk.model";
import { WalkDisplayService } from "../../../../pages/walks/walk-display.service";
import { MapEditComponent } from "../../../../pages/walks/walk-edit/map-edit";
import { MemberLoginService } from "../../../../services/member/member-login.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { BasicMedia, RamblersEventType } from "../../../../models/ramblers-walks-manager";
import { GroupEventDisplayService } from "../../../../pages/group-events/group-event-display.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { isEqual } from "es-toolkit/compat";

@Component({
  selector: "app-card-image-or-map",
  template: `
    @if (memberLoginService.allowWalkAdminEdits()) {
      <input
        id="walkAction-{{displayedWalk?.walk?.id}}" type="submit"
        value="{{displayedWalk?.walkAccessMode?.caption}}"
        (click)="display.edit(displayedWalk)"
        class="btn btn-primary button-container">
    } @else {
      <a [href]="navigationUrl()"
         class="btn btn-primary button-container">view</a>
    }
    @if (mapFallbackActive()) {
      @if (imageNavigationEnabled) {
        <a [href]="navigationUrl()" class="d-block">
          <div app-map-edit readonly
               [class]="this.imageConfig.class"
               [locationDetails]="displayedWalk.walk?.groupEvent?.start_location"
               [walkStatus]="displayedWalk.walk?.groupEvent?.status"
               [gpxFile]="displayedWalk.walk?.fields?.gpxFile"
               [notify]="notify"></div>
        </a>
      } @else {
        <div app-map-edit readonly
             [class]="this.imageConfig.class"
             [locationDetails]="displayedWalk.walk?.groupEvent?.start_location"
             [walkStatus]="displayedWalk.walk?.groupEvent?.status"
             [gpxFile]="displayedWalk.walk?.fields?.gpxFile"
             [notify]="notify"></div>
      }
    }
    @if (!mapFallbackActive() && display.displayImage(displayedWalk.walk)) {
      @if (imageNavigationEnabled) {
        <a [href]="navigationUrl()" class="d-block">
          <img (error)="imageError($event)"
               src="{{basicMedia?.url}}"
               alt="{{basicMedia?.alt}}"
               [height]="this.imageConfig.height"
               class="card-img-top"/>
        </a>
      } @else {
        <img (error)="imageError($event)"
             src="{{basicMedia?.url}}"
             alt="{{basicMedia?.alt}}"
             [height]="this.imageConfig.height"
             class="card-img-top"/>
      }
    }
  `,
  styleUrls: ["./card-image.sass"],
  imports: [FontAwesomeModule, MapEditComponent]
})
export class CardImageOrMap implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("CardImageOrMap", NgxLoggerLevel.ERROR);
  public display = inject(WalkDisplayService);
  public groupEventDisplay = inject(GroupEventDisplayService);
  public mediaQueryService = inject(MediaQueryService);
  protected memberLoginService = inject(MemberLoginService);
  protected basicMedia: BasicMedia;
  protected imageConfig: { class: string, height: number };
  protected imageNavigationEnabled: boolean;
  private _displayedWalk: DisplayedWalk;
  @Input() notify!: AlertInstance;
  @Input() maxColumns!: number;
  @Input() navigationHref: string;

  @Input() set displayedWalk(value: DisplayedWalk) {
    this._displayedWalk = value;
    this.updateBasicMedia();
  }

  get displayedWalk(): DisplayedWalk {
    return this._displayedWalk;
  }

  @Input("imageNavigationEnabled") set imageNavigationEnabledValue(imageNavigationEnabled: boolean) {
    this.imageNavigationEnabled = coerceBooleanProperty(imageNavigationEnabled);
  }

  ngOnInit() {
    this.imageConfig = {class: this.determineClass(), height: this.determineHeight()};
    this.logger.info("ngOnInit:displayedWalk", this.displayedWalk);
    this.updateBasicMedia();
  }

  private updateBasicMedia() {
    if (this.displayedWalk?.walk) {
      this.basicMedia = this.mediaQueryService.imageSourceWithFallback(this.displayedWalk.walk);
      this.logger.info("updateBasicMedia: updated basicMedia for walk", this.displayedWalk.walk.id, "to", this.basicMedia);
    }
  }

  imageError(event: ErrorEvent) {
    this.logger.error("imageError:", event);
    this.basicMedia = FALLBACK_MEDIA;
  }

  determineClass(): string {
    switch (this.maxColumns) {
      case 1:
        return "map-card-image-events";
      case 2:
        return "map-card-image-events";
      case 3:
        return "map-card-image";
      case 4:
        return "map-card-image-events";
      default:
        return "map-card-image-events";
    }
  }

  determineHeight(): number {
    switch (this.maxColumns) {
      case 1:
        return 250;
      case 2:
        return 250;
      case 3:
        return 150;
      case 4:
        return 250;
      default:
        return 250;
    }
  }

  mapFallbackActive(): boolean {
    return this.display.displayMapAsImageFallback(this.displayedWalk?.walk) || this.isFallbackMediaWithMap();
  }

  private isFallbackMediaWithMap(): boolean {
    return this.display.displayMap(this.displayedWalk?.walk) && this.isFallbackMedia();
  }

  private isFallbackMedia(): boolean {
    return isEqual(this.basicMedia?.url, FALLBACK_MEDIA.url);
  }

  navigationUrl(): string {
    const itemType = this.displayedWalk?.walk?.groupEvent?.item_type;
    if (this.navigationHref) {
      return this.navigationHref;
    } else if (itemType === RamblersEventType.GROUP_EVENT) {
      return this.groupEventDisplay.groupEventLink(this.displayedWalk?.walk, true);
    } else {
      return this.display.walkLink(this.displayedWalk?.walk);
    }
  }

}
