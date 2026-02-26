import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from "@angular/core";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

declare const YT: any;

const YOUTUBE_API_CALLBACKS: (() => void)[] = [];
let youtubeApiLoading = false;
let youtubeApiLoaded = false;

function registerYouTubeCallback(callback: () => void): void {
  if (youtubeApiLoaded) {
    callback();
  } else {
    YOUTUBE_API_CALLBACKS.push(callback);
  }
}

function loadYouTubeApiScript(): void {
  if (youtubeApiLoading || youtubeApiLoaded) {
    return;
  }
  youtubeApiLoading = true;

  const existingScript = document.querySelector("script[src*=\"youtube.com/iframe_api\"]");
  if (existingScript) {
    return;
  }

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  (window as any).onYouTubeIframeAPIReady = () => {
    youtubeApiLoaded = true;
    youtubeApiLoading = false;
    YOUTUBE_API_CALLBACKS.forEach(cb => cb());
    YOUTUBE_API_CALLBACKS.length = 0;
  };
}

@Component({
    selector: "app-youtube-embed",
    standalone: true,
    template: `
      @if (youtubeId) {
        <div #playerContainer class="video-container"></div>
      }
    `,
    styles: [`
      :host
        display: block
        width: 100%
        height: 100%

      .video-container
        width: 100%
        height: 100%

      :host ::ng-deep iframe
        position: absolute
        top: 0
        left: 0
        width: 100%
        height: 100%
        border: 0
    `]
})
export class YoutubeEmbed implements AfterViewInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("YoutubeEmbed", NgxLoggerLevel.ERROR);
  private currentYoutubeId: string;
  private player: any;

  @ViewChild("playerContainer") playerContainer: ElementRef;

  @Input()
  title: string;

  @Output()
  playbackStateChange = new EventEmitter<boolean>();

  @Input()
  set youtubeId(value: string) {
    if (this.currentYoutubeId === value) {
      return;
    }
    this.logger.info("YouTube ID changed to:", value);
    this.currentYoutubeId = value;
    if (this.player && value) {
      this.player.loadVideoById(value);
    }
  }

  get youtubeId(): string {
    return this.currentYoutubeId;
  }

  ngAfterViewInit() {
    this.logger.info("ngAfterViewInit called, youtubeId:", this.currentYoutubeId);
    if (this.currentYoutubeId) {
      this.initializePlayer();
    }
  }

  ngOnDestroy() {
    this.logger.info("ngOnDestroy called");
    if (this.player) {
      this.player.destroy();
    }
  }

  private initializePlayer() {
    this.logger.info("Initializing YouTube player for:", this.currentYoutubeId);
    if (!(window as any).YT?.Player) {
      this.logger.info("YouTube API not loaded, registering callback...");
      registerYouTubeCallback(() => this.createPlayer());
      loadYouTubeApiScript();
      return;
    }

    this.createPlayer();
  }

  private createPlayer() {
    if (!this.playerContainer?.nativeElement) {
      this.logger.warn("Player container not available");
      return;
    }
    this.logger.info("Creating YouTube player instance");
    this.player = new YT.Player(this.playerContainer.nativeElement, {
      videoId: this.currentYoutubeId,
      width: "100%",
      height: "100%",
      playerVars: {
        playsinline: 1
      },
      events: {
        onStateChange: (event: any) => this.onPlayerStateChange(event)
      }
    });
  }

  private onPlayerStateChange(event: any) {
    this.logger.info("Player state changed:", event.data);
    const isPlaying = event.data === YT.PlayerState.PLAYING;
    this.logger.info("Emitting playback state:", isPlaying);
    setTimeout(() => this.playbackStateChange.emit(isPlaying));
  }
}
