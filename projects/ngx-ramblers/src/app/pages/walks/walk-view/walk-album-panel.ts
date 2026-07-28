import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faImages } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { ContentMetadata, ContentMetadataItem } from "../../../models/content-metadata.model";
import { RootFolder } from "../../../models/system.model";
import { WalkAlbumPanelStyle } from "../../../models/walks-config.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { SvgComponent } from "../../../modules/common/svg/svg";
import { CardImageComponent } from "../../../modules/common/card/image/card-image";
import { SwipeableDirective } from "../../../modules/common/swipe/swipeable.directive";

@Component({
  selector: "app-walk-album-panel",
  styles: [`
    :host
      display: flex
      flex-direction: column
      margin-bottom: 0
      min-height: 0
      height: 100%

    .walk-album-panel
      display: flex
      flex-direction: column
      flex: 1 1 auto
      height: 100%
      min-height: 0
      background: #fff
      border: 1px solid rgba(29, 53, 87, 0.1)
      border-radius: 6px
      overflow: hidden
      box-shadow: 0 1px 2px rgba(29, 53, 87, 0.04)

    .walk-album-panel-cover
      width: 100%
      flex: 1 1 auto
      min-height: 0
      background: #f7f8f9
      display: flex
      align-items: center
      justify-content: center
      overflow: hidden
      position: relative

    .walk-album-panel-cover img
      width: 100%
      height: 100%
      object-fit: cover
      display: block

    .walk-album-panel-cover-icon
      font-size: 1.75rem
      color: rgba(29, 53, 87, 0.35)

    .swiper-viewport
      width: 100%
      height: 100%
      overflow: hidden
      -webkit-user-select: none
      user-select: none
      touch-action: pan-y
      cursor: grab

      img
        pointer-events: none
        -webkit-user-drag: none

    .swiper-viewport.dragging
      cursor: grabbing

    .swiper-strip
      display: flex
      height: 100%
      will-change: transform
      &.align-start
        align-items: flex-start
        height: auto

    .swiper-slide
      flex: 0 0 100%
      height: 100%
      min-width: 0
      &.auto-height
        height: auto

    .walk-album-panel-body
      flex: 0 0 auto
      padding: 12px 16px 14px
      display: flex
      align-items: center
      justify-content: space-between
      gap: 12px

    .walk-album-panel-copy
      min-width: 0
      flex: 1 1 auto

    .walk-album-panel-title
      font-size: 16px
      font-weight: bold
      line-height: 1.25
      margin: 0

    .walk-album-panel-meta
      margin: 4px 0 0
      font-size: 0.9rem
      color: rgba(29, 53, 87, 0.65)
      line-height: 1.35

    .walk-album-panel-nav
      display: flex
      align-items: center
      flex-shrink: 0
      gap: 2px

    .walk-album-panel-counter
      font-size: 0.85rem
      color: rgba(29, 53, 87, 0.65)
      white-space: nowrap
      padding: 0 6px

    a.walk-album-panel-link
      color: inherit
      text-decoration: none

    a.walk-album-panel-link:hover .walk-album-panel-title,
    a.walk-album-panel-link:focus-visible .walk-album-panel-title
      text-decoration: underline

    .walk-album-match
      display: flex
      flex-direction: column
      flex: 1 1 auto
      height: 100%
      min-height: 0
      padding: 12px 14px 14px
      background: #fff
      border: 1px solid rgba(29, 53, 87, 0.1)
      border-radius: 6px
      box-shadow: 0 1px 2px rgba(29, 53, 87, 0.04)

    .walk-album-match-header
      display: flex
      align-items: center
      flex-wrap: nowrap
      gap: 0.5rem
      min-width: 0
      margin-bottom: 10px

    .walk-album-match-nav
      display: flex
      align-items: center
      flex-shrink: 0

    .walk-album-match-image
      position: relative
      min-width: 0
      border-radius: 6px
      overflow: hidden
  `],
  template: `
    @if (albumPath && (imageUrls.length > 0 || panelStyle === WalkAlbumPanelStyle.CARD)) {
      @if (panelStyle === WalkAlbumPanelStyle.MATCH_WALK_IMAGES) {
        <div class="walk-album-match pointer"
             [tooltip]="currentImageTooltip()"
             [placement]="'bottom'">
          <div class="walk-album-match-header">
            @if (imageUrls.length > 1) {
              <div class="walk-album-match-nav">
                <app-svg [colour]="navColour" (click)="back()"
                         [disabled]="backDisabled()"
                         height="20"
                         icon="i-back-round"/>
                <span class="visually-hidden">Previous slide</span>
                <span class="px-2 text-nowrap">Image {{ imageIndex + 1 }}
                  of {{ imageUrls.length }}</span>
                <app-svg [colour]="navColour" (click)="next()"
                         [disabled]="forwardDisabled()"
                         height="20"
                         icon="i-forward-round"/>
                <span class="visually-hidden">Next slide</span>
              </div>
            }
            <a class="ms-auto text-nowrap rams-text-decoration-pink"
               [routerLink]="'/' + albumPath"
               tooltip="Open the full photo album">Photo album</a>
          </div>
          <div class="walk-album-match-image">
            @if (imageUrls.length > 1) {
              <div class="swiper-viewport" appSwipeable
                   (draggingChange)="dragging = $event"
                   (swipeOffset)="dragOffsetX = $event"
                   (swipeDelta)="onSwipeDelta($event)">
                <div class="swiper-strip align-start"
                     [class.dragging]="dragging"
                     [style.transform]="stripTransform"
                     [style.transition]="dragTransition">
                  @for (imageUrl of imageUrls; track imageUrl) {
                    <div class="swiper-slide auto-height">
                      <app-card-image [height]="panelHeight"
                                      [imageSource]="imageUrl"/>
                    </div>
                  }
                </div>
              </div>
            } @else if (currentImageUrl) {
              <app-card-image [height]="panelHeight"
                              [imageSource]="currentImageUrl"/>
            }
          </div>
        </div>
      } @else {
        <div class="walk-album-panel">
          <div class="walk-album-panel-cover" [style.height.px]="panelHeight">
            @if (imageUrls.length > 1) {
              <div class="swiper-viewport"
                   [class.dragging]="dragging"
                   appSwipeable
                   (draggingChange)="dragging = $event"
                   (swipeOffset)="dragOffsetX = $event"
                   (swipeDelta)="onSwipeDelta($event)">
                <div class="swiper-strip"
                     [style.transform]="stripTransform"
                     [style.transition]="dragTransition">
                  @for (imageUrl of imageUrls; track imageUrl; let slideIndex = $index) {
                    <div class="swiper-slide">
                      <img [src]="imageUrl" [alt]="'Walk photo ' + (slideIndex + 1)"/>
                    </div>
                  }
                </div>
              </div>
            } @else if (currentImageUrl) {
              <img [src]="currentImageUrl" alt="Photo album cover"/>
            } @else {
              <fa-icon class="walk-album-panel-cover-icon" [icon]="faImages"/>
            }
          </div>
          <div class="walk-album-panel-body">
            <div class="walk-album-panel-copy">
              <a class="walk-album-panel-link"
                 [routerLink]="'/' + albumPath"
                 tooltip="Open the full photo album">
                <p class="walk-album-panel-title">Photo album</p>
                <p class="walk-album-panel-meta">
                  @if (imageUrls.length > 1) {
                    Swipe to browse · open full album
                  } @else {
                    View photos from this walk
                  }
                </p>
              </a>
            </div>
            @if (imageUrls.length > 1) {
              <div class="walk-album-panel-nav" role="group" aria-label="Album photos">
                <button type="button" class="btn border-0 bg-transparent p-0"
                        (click)="back()"
                        [disabled]="backDisabled()"
                        aria-label="Previous photo"
                        tooltip="Previous photo">
                  <app-svg [colour]="navColour"
                           [disabled]="backDisabled()"
                           height="28"
                           icon="i-back-round"/>
                </button>
                <span class="walk-album-panel-counter">{{ imageIndex + 1 }} / {{ imageUrls.length }}</span>
                <button type="button" class="btn border-0 bg-transparent p-0"
                        (click)="next()"
                        [disabled]="forwardDisabled()"
                        aria-label="Next photo"
                        tooltip="Next photo">
                  <app-svg [colour]="navColour"
                           [disabled]="forwardDisabled()"
                           height="28"
                           icon="i-forward-round"/>
                </button>
              </div>
            }
          </div>
        </div>
      }
    }
  `,
  imports: [RouterLink, FontAwesomeModule, TooltipDirective, SvgComponent, CardImageComponent, SwipeableDirective]
})
export class WalkAlbumPanelComponent implements OnInit, OnDestroy {
  private logger = inject(LoggerFactory).createLogger("WalkAlbumPanelComponent", NgxLoggerLevel.ERROR);
  private contentMetadataService = inject(ContentMetadataService);
  private urlService = inject(UrlService);
  private walksConfigService = inject(WalksConfigService);
  private subscriptions: Subscription[] = [];
  protected readonly faImages = faImages;
  protected readonly navColour = "var(--ramblers-colour-mintcake)";
  protected readonly WalkAlbumPanelStyle = WalkAlbumPanelStyle;
  protected panelStyle: WalkAlbumPanelStyle = WalkAlbumPanelStyle.CARD;
  protected panelHeight = 240;
  protected imageUrls: string[] = [];
  protected imageIndex = 0;
  protected dragging = false;
  protected dragOffsetX = 0;
  private loadToken = 0;
  private currentAlbumPath: string | null = null;
  private currentAlbumName: string | null = null;
  private currentCoverImageUrl: string | null = null;

  @Input() set albumPath(path: string | null) {
    this.currentAlbumPath = path;
    this.reloadImages();
  }

  get albumPath(): string | null {
    return this.currentAlbumPath;
  }

  @Input() set albumName(name: string | null) {
    this.currentAlbumName = name;
    this.reloadImages();
  }

  @Input() set coverImageUrl(url: string | null) {
    this.currentCoverImageUrl = url;
    if (this.imageUrls.length === 0 && url) {
      this.imageUrls = [url];
      this.imageIndex = 0;
    }
  }

  get currentImageUrl(): string | null {
    return this.imageUrls[this.imageIndex] || this.currentCoverImageUrl || null;
  }

  ngOnInit(): void {
    this.subscriptions.push(this.walksConfigService.events().subscribe(walksConfig => {
      this.panelStyle = walksConfig?.walkAlbumPanelStyle || WalkAlbumPanelStyle.CARD;
      this.panelHeight = walksConfig?.walkAlbumPanelHeight || 240;
    }));
  }

  ngOnDestroy(): void {
    this.loadToken += 1;
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  currentImageTooltip(): string {
    return this.imageUrls.length > 1
      ? `Photo album image ${this.imageIndex + 1} of ${this.imageUrls.length}`
      : "Photo album";
  }

  back(): void {
    if (this.imageIndex > 0) {
      this.imageIndex -= 1;
    }
  }

  next(): void {
    if (this.imageIndex < this.imageUrls.length - 1) {
      this.imageIndex += 1;
    }
  }

  backDisabled(): boolean {
    return this.imageIndex === 0;
  }

  forwardDisabled(): boolean {
    return this.imageIndex >= this.imageUrls.length - 1;
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

  private reloadImages(): void {
    const path = this.currentAlbumPath;
    if (!path) {
      this.imageUrls = [];
      this.imageIndex = 0;
      return;
    }
    const token = ++this.loadToken;
    const names = [this.currentAlbumName, path]
      .filter(Boolean)
      .filter((name, index, all) => all.indexOf(name) === index) as string[];
    this.loadAlbumImages(names, token);
  }

  private async loadAlbumImages(names: string[], token: number): Promise<void> {
    try {
      const albums = await Promise.all(names.map(name =>
        this.contentMetadataService.items(RootFolder.carousels, name).catch(() => null)
      ));
      if (token !== this.loadToken) {
        return;
      }
      const album = albums.find(candidate => (candidate?.files || []).some(file => !!file?.image))
        || albums.find(Boolean)
        || null;
      const urls = this.imageUrlsFrom(album);
      if (urls.length > 0) {
        this.imageUrls = urls;
        this.imageIndex = 0;
      } else if (this.currentCoverImageUrl) {
        this.imageUrls = [this.currentCoverImageUrl];
        this.imageIndex = 0;
      } else {
        this.imageUrls = [];
        this.imageIndex = 0;
      }
    } catch (error) {
      this.logger.warn("loadAlbumImages failed", error);
      if (token === this.loadToken && this.currentCoverImageUrl) {
        this.imageUrls = [this.currentCoverImageUrl];
        this.imageIndex = 0;
      }
    }
  }

  private imageUrlsFrom(album: ContentMetadata | null): string[] {
    const files = (album?.files || []).filter(file => !!file?.image);
    const orderedFiles = this.withCoverImageFirst(files, album?.coverImage);
    return orderedFiles
      .map(file => this.urlService.imageSourceFor(file as ContentMetadataItem, album))
      .filter(Boolean);
  }

  private withCoverImageFirst(files: ContentMetadataItem[], coverImage: string | null | undefined): ContentMetadataItem[] {
    if (!coverImage || files.length === 0) {
      return files;
    }
    const coverIndex = files.findIndex(file => file.image === coverImage);
    if (coverIndex <= 0) {
      return files;
    }
    const cover = files[coverIndex];
    return [cover].concat(files.filter((_, index) => index !== coverIndex));
  }
}
