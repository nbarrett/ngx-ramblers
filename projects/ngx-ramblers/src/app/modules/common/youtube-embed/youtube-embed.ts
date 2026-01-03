import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from "@angular/core";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

declare const YT: any;

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
        position: absolute
        top: 0
        right: 0
        bottom: 0
        left: 0
        width: 100%
        height: 100%
        display: block

      .video-container
        width: 100%
        height: 100%
        position: relative
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
    if (typeof YT === "undefined" || !YT.Player) {
      this.logger.info("YouTube API not loaded, loading script...");
      this.loadYouTubeAPI();
      return;
    }

    this.createPlayer();
  }

  private loadYouTubeAPI() {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      this.logger.info("YouTube API loaded");
      this.createPlayer();
    };
  }

  private createPlayer() {
    this.logger.info("Creating YouTube player instance");
    this.player = new YT.Player(this.playerContainer.nativeElement, {
      videoId: this.currentYoutubeId,
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
    this.playbackStateChange.emit(isPlaying);
  }
}
