import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { UrlService } from "../../../../services/url.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MediaQueryService } from "../../../../services/committee/media-query.service";
import { DisplayedWalk, FALLBACK_MEDIA } from "../../../../models/walk.model";
import { WalkDisplayService } from "../../../../pages/walks/walk-display.service";
import { MapEditComponent } from "../../../../pages/walks/walk-edit/map-edit";
import { MemberLoginService } from "../../../../services/member/member-login.service";
import { AlertInstance } from "../../../../services/notifier.service";
import { BasicMedia } from "../../../../models/ramblers-walks-manager";
import { RouterLink } from "@angular/router";
import { SocialDisplayService } from "../../../../pages/social/social-display.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-card-image-or-map",
  template: `
    @if (display.walkPopulationLocal() && memberLoginService.memberLoggedIn() && displayedWalk?.walkAccessMode?.walkWritable) {
      <input
        id="walkAction-{{displayedWalk?.walk?.id}}" type="submit"
        value="{{displayedWalk?.walkAccessMode?.caption}}"
        (click)="display.edit(displayedWalk)"
        class="btn btn-primary button-container">
    }
    @if (display.displayMapAsImageFallback(displayedWalk.walk)) {
      <div app-map-edit readonly
           [class]="this.imageConfig.class"
           [locationDetails]="displayedWalk.walk?.groupEvent?.start_location"
           [notify]="notify"></div>
    }
    @if (display.displayImage(displayedWalk.walk)) {
      <img (error)="imageError($event)"
           src="{{basicMedia?.url}}"
           alt="{{basicMedia?.alt}}"
           [height]="this.imageConfig.height"
           [routerLink]="imageNavigationEnabled ? urlService.routerLinkUrl(socialDisplayService.groupEventLink(displayedWalk.walk, true)) : null"
           class="card-img-top"/>
    }
  `,
  styleUrls: ["./card-image.sass"],
  imports: [FontAwesomeModule, MapEditComponent, RouterLink]
})
export class CardImageOrMap implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("CardImageOrMap", NgxLoggerLevel.ERROR);
  public urlService = inject(UrlService);
  public display = inject(WalkDisplayService);
  public socialDisplayService = inject(SocialDisplayService);
  public mediaQueryService = inject(MediaQueryService);
  protected memberLoginService = inject(MemberLoginService);
  protected basicMedia: BasicMedia;
  protected imageConfig: { class: string, height: number };
  protected imageNavigationEnabled: boolean;
  private _displayedWalk: DisplayedWalk;
  @Input() notify!: AlertInstance;
  @Input() maxColumns!: number;

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

}

