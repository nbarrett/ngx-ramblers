import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, inject, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgxLoggerLevel } from "ngx-logger";
import {
  ContentMetadataItem,
  DuplicateImages,
  HasEventId,
  imageAlt,
  ImageTag,
  LazyLoadingMetadata,
  RECENT_PHOTOS,
  SlideInitialisation
} from "../../models/content-metadata.model";
import { AlbumData, DEFAULT_TIMELINE_OPTIONS, TimelinePalette, TimelinePlayDirection, TimelineViewOptions } from "../../models/content-text.model";
import { groupEventTypeFor } from "../../models/committee.model";
import { EventSlugResolverService } from "../../services/walks-and-events/event-slug-resolver.service";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DELAYED_TOOLTIP_PROVIDERS } from "../../modules/common/tooltip-config";
import { LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { UiActionsService } from "../../services/ui-actions.service";
import { UIDateFormat } from "../../models/date-format.model";
import { StoredValue } from "../../models/ui-actions";
import { YoutubeEmbed } from "../../modules/common/youtube-embed/youtube-embed";
import { LazyLoadDirective } from "../../notifications/common/lazy-load.directive";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";
import { CarouselStoryNavigatorComponent } from "../../carousel/view/carousel-story-navigator/carousel-story-navigator.component";
import { dayKey, spacedTimelineLabels, timelineIndexFromQuery, timelineSlides, timelineStartIndex, timelineTicks, TimelineTick, visibleTimelineTicks, wheelScrubsFilm } from "./timeline-film";

@Component({
  selector: "app-album-timeline",
  styleUrls: ["./album-timeline.sass"],
  template: `
    <div class="album-timeline" [class]="'palette-' + palette()" [class.is-ready]="filmReady"
         [class.instant-film]="filmInstant">
        <div class="timeline-meta">
          <p class="timeline-kicker">
            <span class="timeline-kicker-label">{{ kicker() }}</span>
            @if (!preview && album?.showStoryNavigator) {
              <button type="button" class="story-toggle" (click)="toggleStories($event)"
                      [attr.aria-expanded]="storiesOpen" aria-label="Choose story">
                {{ currentTag?.subject || "Story" }}
              </button>
            }
          </p>
          <p class="timeline-date">{{ currentDateLabel() }}
            <span class="timeline-count">{{ current + 1 }} / {{ slides.length }}</span>
          </p>
          @if (currentTitle()) {
            @if (currentEvent(); as event) {
              <a class="timeline-event" [href]="eventUrl(event)"
                 [tooltip]="eventTooltip(event)" placement="bottom">{{ currentTitle() }}</a>
            } @else {
              <p class="timeline-title">{{ currentTitle() }}</p>
            }
          }
        </div>
        @if (!preview && album?.showStoryNavigator) {
          <div class="timeline-stories" [class.open]="storiesOpen" (click)="$event.stopPropagation()">
            <app-carousel-story-navigator
              [imageTags]="lazyLoadingMetadata?.contentMetadata?.imageTags"
              [index]="index"
              (tagChanged)="tagChanged($event)"/>
          </div>
        }
        <button type="button" class="timeline-arrow left" (click)="step(-1)" aria-label="Previous photo">‹</button>
        <button type="button" class="timeline-arrow right" (click)="step(1)" aria-label="Next photo">›</button>
        <div #track class="timeline-track" tabindex="0"
             (pointerdown)="onTrackDown($event)"
             (pointermove)="onTrackMove($event)"
             (pointerup)="onTrackUp()"
             (pointercancel)="onTrackUp()"
             (wheel)="onWheel($event)"
             [class.dragging]="dragging"
             [style.height.px]="trackHeight()">
          <div #film class="timeline-film" [style.transform]="'translate3d(' + x + 'px,0,0)'">
            @for (slide of slides; track slide._id || slide.image || $index; let i = $index) {
              <figure class="timeline-slide" [attr.data-i]="i" [style.height.px]="photoHeight()">
                @if (slide.youtubeId) {
                  <div class="timeline-video" [style.height.px]="photoHeight()" [style.width.px]="photoHeight() * 16 / 9">
                    <app-youtube-embed [youtubeId]="slide.youtubeId" [title]="slide.text || 'YouTube video'"
                                       (playbackStateChange)="onVideoPlaybackChange(i, $event)"/>
                  </div>
                } @else if (isNear(i)) {
                  <img [src]="imageSource(slide)" [alt]="imageAlt(slide)" draggable="false"
                       [style.height.px]="photoHeight()" (load)="onImageLoad()">
                } @else {
                  <img lazyLoad="{{ imageSource(slide) }}" [alt]="imageAlt(slide)" draggable="false"
                       [style.height.px]="photoHeight()" (load)="onImageLoad()">
                }
              </figure>
            }
          </div>
        </div>
        <div class="timeline-bar">
          <div class="scrub-labels">
            @for (label of labels; track label.index + '-' + label.key; let i = $index) {
              <button type="button" class="scrub-label"
                      [class.start]="i === 0"
                      [class.end]="i === labels.length - 1"
                      [style.left.%]="label.pct"
                      (click)="goIndex(label.index, true)">{{ formatTick(label) }}</button>
            }
          </div>
          <div #scrub class="scrub" role="slider" tabindex="0" [attr.aria-valuenow]="current + 1"
               [attr.aria-valuemin]="1" [attr.aria-valuemax]="slides.length" aria-label="Album timeline"
               (pointerdown)="onScrubDown($event)"
               (pointermove)="onScrubMove($event)"
               (pointerup)="onScrubUp()"
               (pointercancel)="onScrubUp()">
            <div class="scrub-knob" [style.left.%]="knobPercent"></div>
            <div class="scrub-days">
              @for (tick of visibleTicks; track tick.index + '-' + tick.key) {
                <button type="button" class="tick"
                        [class.major]="tickIsMajor(tick)"
                        [class.on]="tickIsCurrent(tick)"
                        [style.left.%]="tick.pct"
                        [attr.aria-label]="formatTick(tick)" (click)="goIndex(tick.index)"></button>
              }
            </div>
          </div>
        </div>
      </div>
  `,
  imports: [YoutubeEmbed, LazyLoadDirective, CarouselStoryNavigatorComponent, TooltipDirective],
  providers: [...DELAYED_TOOLTIP_PROVIDERS]
})
export class AlbumTimelineComponent implements AfterViewInit, OnChanges, OnDestroy {
  protected readonly imageAlt = imageAlt;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumTimelineComponent", NgxLoggerLevel.ERROR);
  public urlService: UrlService = inject(UrlService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  public lazyLoadingMetadataService: LazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  public uiActions: UiActionsService = inject(UiActionsService);
  private eventSlugResolver = inject(EventSlugResolverService);
  private changeDetector = inject(ChangeDetectorRef);

  @ViewChild("track") trackRef?: ElementRef<HTMLElement>;
  @ViewChild("film") filmRef?: ElementRef<HTMLElement>;
  @ViewChild("scrub") scrubRef?: ElementRef<HTMLElement>;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
  }

  @Input() album: AlbumData;
  @Input() lazyLoadingMetadata: LazyLoadingMetadata;
  @Input() duplicateImages: DuplicateImages;
  @Input() index: number;
  public preview = false;
  public storiesOpen = false;
  public currentTag: ImageTag = RECENT_PHOTOS;
  public slides: ContentMetadataItem[] = [];
  public ticks: TimelineTick[] = [];
  public visibleTicks: TimelineTick[] = [];
  public labels: TimelineTick[] = [];
  public current = 0;
  public x = 0;
  public dragging = false;
  private dragStartX = 0;
  private dragOrigin = 0;
  private scrubbing = false;
  private scrubRatio = 0;
  private scrubEl?: HTMLElement;
  private playTimer: ReturnType<typeof setInterval> | null = null;
  private hasUserMoved = false;
  private viewInitialised = false;
  public videoIsPlaying = false;
  public filmReady = false;
  public filmInstant = true;
  public knobPercent = 0;


  ngOnChanges(_changes: SimpleChanges): void {
    this.refreshSlides();
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      this.rebuildLabels();
      this.applyUrlIndex();
      this.goIndex(this.current);
      this.restartPlay();
    });
    this.viewInitialised = true;
  }

  ngOnDestroy(): void {
    this.stopPlay();
  }

  toggleStories(event: Event): void {
    event.stopPropagation();
    this.storiesOpen = !this.storiesOpen;
  }

  tagChanged(imageTag: ImageTag): void {
    if (imageTag && imageTag.key !== this.currentTag?.key) {
      const resetToStart = this.viewInitialised;
      this.currentTag = imageTag;
      this.storiesOpen = false;
      this.hasUserMoved = false;
      this.refreshSlides(resetToStart);
      requestAnimationFrame(() => {
        this.goIndex(this.current, resetToStart);
        this.restartPlay();
      });
    }
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.storiesOpen && !target.closest(".story-toggle") && !target.closest(".timeline-stories")) {
      this.storiesOpen = false;
    }
  }

  @HostListener("window:resize")
  onResize(): void {
    this.rebuildLabels();
    this.goIndex(this.current);
  }

  @HostListener("keydown", ["$event"])
  onKey(event: KeyboardEvent): void {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      this.step(1);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      this.step(-1);
    }
  }

  imageSource(item: ContentMetadataItem): string {
    return this.urlService.imageSourceFor(item, this.lazyLoadingMetadata?.contentMetadata);
  }

  options(): TimelineViewOptions {
    return {...DEFAULT_TIMELINE_OPTIONS, ...this.album?.timelineViewOptions};
  }

  kicker(): string {
    return this.options().kicker || DEFAULT_TIMELINE_OPTIONS.kicker;
  }

  palette(): TimelinePalette {
    return this.options().palette || TimelinePalette.MINTCAKE;
  }

  trackHeight(): number {
    return this.album?.height || 420;
  }

  photoHeight(): number {
    return Math.max(160, this.trackHeight() - 32);
  }

  currentDateLabel(): string {
    const date = this.slides[this.current]?.date;
    return date ? this.dateUtils.displayDate(date) : "Album";
  }

  currentTitle(): string {
    return this.slides[this.current]?.text || "";
  }

  currentEvent(): HasEventId | null {
    const slide = this.slides[this.current];
    if (slide?.eventId) {
      return slide;
    } else if (this.album?.eventId) {
      return {dateSource: this.album.eventType, eventId: this.album.eventId};
    } else {
      return null;
    }
  }

  eventTooltip(event: HasEventId): string {
    return "Show details of this " + (groupEventTypeFor(event.dateSource)?.description || event.dateSource || "event").toLowerCase();
  }

  eventUrl(event: HasEventId): string {
    return this.urlService.eventUrl({
      ...event,
      eventId: this.eventSlugResolver.slugOrId(event.eventId)
    });
  }

  formatTick(tick: TimelineTick): string {
    const slide = this.slides[tick.index];
    return slide?.date ? this.dateUtils.asString(slide.date, null, UIDateFormat.DAY_MONTH_ABBREVIATED_YEAR) : tick.key;
  }

  tickIsCurrent(tick: TimelineTick): boolean {
    return dayKey(this.slides[this.current]?.date) === tick.key;
  }

  tickIsMajor(tick: TimelineTick): boolean {
    return this.labels.some(label => label.key === tick.key);
  }

  progressPct(): number {
    if (this.slides.length <= 1) {
      return 0;
    } else {
      return (this.current / (this.slides.length - 1)) * 100;
    }
  }

  knobPct(): number {
    if (this.scrubbing) {
      return this.scrubRatio * 100;
    } else {
      return this.progressPct();
    }
  }

  step(delta: number): void {
    this.hasUserMoved = true;
    this.goIndex(this.current + delta, true);
    this.restartPlay();
  }

  goIndex(i: number, syncUrl = false): void {
    const n = Math.max(0, Math.min(this.slides.length - 1, i));
    const span = Math.abs(n - this.current);
    const resumeAfterVideo = this.videoIsPlaying && n !== this.current;
    if (n !== this.current) {
      this.videoIsPlaying = false;
    }
    this.filmInstant = this.dragging || this.scrubbing || !this.filmReady || span > 1;
    this.current = n;
    const track = this.trackRef?.nativeElement;
    const film = this.filmRef?.nativeElement;
    const slide = film?.querySelectorAll<HTMLElement>(".timeline-slide")[n];
    if (track && slide) {
      const mid = track.clientWidth / 2;
      this.x = -(slide.offsetLeft + Math.max(slide.offsetWidth, 1) / 2 - mid);
    }
    if (!this.scrubbing && !this.dragging) {
      this.rebuildBarMarks();
    }
    if (syncUrl) {
      this.syncUrl();
    }
    if (this.slides.length) {
      this.filmReady = true;
    }
    this.knobPercent = this.knobPct();
    if (resumeAfterVideo) {
      this.ensurePlay();
    }
  }

  isNear(index: number): boolean {
    return Math.abs(index - this.current) <= 2;
  }

  onImageLoad(): void {
    this.goIndex(this.current);
  }

  onVideoPlaybackChange(index: number, playing: boolean): void {
    if (index === this.current) {
      this.videoIsPlaying = playing;
      if (playing) {
        this.stopPlay();
      } else {
        this.ensurePlay();
      }
    }
  }

  onWheel(event: WheelEvent): void {
    if (wheelScrubsFilm(event.deltaX, event.deltaY)) {
      event.preventDefault();
      this.nudge(-(event.deltaX || event.deltaY));
    }
  }

  @HostListener("document:visibilitychange")
  onVisibilityChange(): void {
    if (document.hidden) {
      this.stopPlay();
    } else {
      this.ensurePlay();
    }
  }

  onTrackDown(event: PointerEvent): void {
    const video = event.target instanceof Element && event.target.closest(".timeline-video");
    if (!video) {
      this.stopPlay();
      this.dragging = true;
      this.dragStartX = event.clientX;
      this.dragOrigin = this.x;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }
  }

  onTrackMove(event: PointerEvent): void {
    if (this.dragging) {
      this.x = this.dragOrigin + (event.clientX - this.dragStartX);
      this.snapNearest();
    }
  }

  onTrackUp(): void {
    if (this.dragging) {
      this.dragging = false;
      this.hasUserMoved = true;
      this.goIndex(this.current, true);
      this.restartPlay();
    }
  }

  onScrubDown(event: PointerEvent): void {
    this.stopPlay();
    this.scrubbing = true;
    this.scrubEl = event.currentTarget as HTMLElement;
    this.seekScrub(event);
    this.scrubEl.setPointerCapture?.(event.pointerId);
  }

  onScrubMove(event: PointerEvent): void {
    if (this.scrubbing) {
      this.seekScrub(event);
    }
  }

  onScrubUp(): void {
    if (this.scrubbing) {
      this.scrubbing = false;
      this.hasUserMoved = true;
      this.goIndex(this.current, true);
      this.restartPlay();
    }
  }

  private seekScrub(event: PointerEvent): void {
    const scrub = this.scrubEl;
    if (scrub) {
      const rect = scrub.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      this.scrubRatio = t;
      this.knobPercent = t * 100;
      this.goIndex(Math.round(t * Math.max(0, this.slides.length - 1)));
    }
  }

  private nudge(dx: number): void {
    this.x += dx;
    this.snapNearest();
  }

  private snapNearest(): void {
    const track = this.trackRef?.nativeElement;
    const film = this.filmRef?.nativeElement;
    if (track && film) {
      const mid = track.getBoundingClientRect().left + track.clientWidth / 2;
      const nodes = Array.from(film.querySelectorAll<HTMLElement>(".timeline-slide"));
      let best = 0;
      let bestDist = Infinity;
      nodes.forEach((node, i) => {
        const r = node.getBoundingClientRect();
        const dist = Math.abs(r.left + r.width / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      this.current = best;
    }
  }

  private refreshSlides(resetToStart = false): void {
    if (this.lazyLoadingMetadata) {
      this.lazyLoadingMetadataService.initialiseAvailableSlides(
        this.lazyLoadingMetadata,
        SlideInitialisation.TAG_CHANGE,
        this.duplicateImages,
        this.currentTag
      );
    }
    this.slides = timelineSlides(this.lazyLoadingMetadata?.availableSlides);
    this.ticks = timelineTicks(this.slides);
    this.current = Math.max(0, Math.min(this.slides.length - 1, this.current));
    if (resetToStart) {
      this.current = this.startIndex();
    } else if (this.uiActions.queryParameter(StoredValue.TIMELINE, this.index)) {
      this.applyUrlIndex();
    } else if (!this.hasUserMoved) {
      this.current = this.startIndex();
    }
    this.rebuildBarMarks();
    if (this.trackRef) {
      this.goIndex(this.current);
    }
    this.ensurePlay();
  }

  private playStep(): number {
    return this.options().playDirection === TimelinePlayDirection.FORWARDS ? 1 : -1;
  }

  private startIndex(): number {
    return timelineStartIndex(this.playStep() === 1, this.slides.length);
  }

  private ensurePlay(): void {
    if (!this.playTimer && !this.dragging && !this.scrubbing) {
      this.restartPlay();
    }
  }

  private restartPlay(): void {
    this.stopPlay();
    const interval = this.album?.slideInterval || 0;
    if (!this.preview && !this.videoIsPlaying && !document.hidden && interval > 0 && this.slides.length > 1) {
      this.playTimer = setInterval(() => this.advancePlay(), interval);
    }
  }

  private stopPlay(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  private advancePlay(): void {
    if (!this.dragging && !this.scrubbing && !this.storiesOpen && this.slides.length) {
      const n = this.slides.length;
      const next = (this.current + this.playStep() + n) % n;
      this.goIndex(next, true);
      this.changeDetector.detectChanges();
    }
  }

  private applyUrlIndex(): void {
    const fromUrl = timelineIndexFromQuery(this.uiActions.queryParameter(StoredValue.TIMELINE, this.index), this.slides.length);
    if (fromUrl !== null) {
      this.current = fromUrl;
    }
  }

  private syncUrl(): void {
    if (!this.preview && this.slides.length) {
      this.uiActions.updateQueryParameter(StoredValue.TIMELINE, this.current + 1, true, this.index);
    }
  }

  private rebuildLabels(): void {
    this.rebuildBarMarks();
  }

  private rebuildBarMarks(): void {
    const width = this.scrubRef?.nativeElement.clientWidth || 320;
    if (this.slides.length <= 8) {
      const last = Math.max(1, this.slides.length - 1);
      this.visibleTicks = this.slides.map((slide, index) => ({
        index,
        key: dayKey(slide.date) || String(index),
        pct: (index / last) * 100
      }));
      this.labels = this.visibleTicks;
    } else {
      const labelMinPct = Math.max(14, (96 / width) * 100);
      const tickMinPct = Math.max(1.8, (14 / width) * 100);
      this.labels = spacedTimelineLabels(this.ticks, labelMinPct);
      this.visibleTicks = visibleTimelineTicks(this.ticks, tickMinPct, dayKey(this.slides[this.current]?.date));
    }
  }
}
